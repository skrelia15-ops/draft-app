import {
  ArrowLeft,
  Gps,
  MapPoint,
  Routing2,
} from '@solar-icons/react-native/Linear';
import * as Location from 'expo-location';
import { router, Stack, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/map/BottomSheet';
import { SmartBanner } from '@/components/map/SmartBanner';
import { SmartPanel } from '@/components/map/SmartPanel';
import { compassBearing, offsetCoords } from '@/components/map/markers';
import { PermissionGate } from '@/components/map/PermissionGate';
import { EMPTY_ENDPOINT, type Endpoint, type Field, type RouteState } from '@/components/map/types';
import { useUserLocation } from '@/hooks/useUserLocation';
import { toast } from '@/lib/toast';
import {
  autocompletePlaces,
  darkMapStyle,
  MAP_PROVIDER,
  ODESSA,
  getCyclingDirections,
  getPlaceDetails,
  type LatLng,
  type PlacePrediction,
} from '@/lib/maps';
import {
  draftPotentialColor,
  getNearbyRiders,
  useRide,
  deriveConditions,
  directionsToCandidate,
  scoreTodayFit,
  type Recommendation,
} from '@/lib/ride';
import { useWeather } from '@/lib/weather';
import { useProfile } from '@/lib/profile';
import { useRoutes } from '@/lib/routes';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Default region centered on Odessa — used briefly before the first
 * location fix arrives. The map animates to the user's actual position
 * as soon as `useUserLocation` resolves.
 */
const FALLBACK_REGION: Region = {
  latitude: ODESSA.latitude,
  longitude: ODESSA.longitude,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SEARCH_DEBOUNCE_MS = 250;

const FALLBACK_WEATHER_SMART = {
  windKmh: 0, windDeg: 0, windFrom: 'N' as const, tempC: 0, feelsLikeC: 0,
  isRaining: false, rainMmLastHour: 0, observedAt: 0,
};

export default function RideMapScreen() {
  const insets = useSafeAreaInsets();
  const { startRide } = useRide();

  const mapRef = useRef<MapView | null>(null);
  const originInputRef = useRef<TextInput | null>(null);
  const destInputRef = useRef<TextInput | null>(null);
  const cameraCenteredRef = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const directionsAbortRef = useRef<AbortController | null>(null);

  const { status: locStatus, coords, errorMessage: locError, retry } =
    useUserLocation();

  const { weather } = useWeather();
  const { profile } = useProfile();
  const { routes: catalog } = useRoutes();
  const conditions = useMemo(
    () => deriveConditions(weather ?? FALLBACK_WEATHER_SMART),
    [weather],
  );

  const [smartOpen, setSmartOpen] = useState(false);
  const [destRecs, setDestRecs] = useState<Recommendation[] | null>(null);
  const [destLoading, setDestLoading] = useState(false);

  const [origin, setOrigin] = useState<Endpoint>(EMPTY_ENDPOINT);
  const [destination, setDestination] = useState<Endpoint>(EMPTY_ENDPOINT);

  const [activeField, setActiveField] = useState<Field | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);

  const [pickOnMap, setPickOnMap] = useState<Field | null>(null);

  const [routeState, setRouteState] = useState<RouteState>({ kind: 'idle' });
  const [trafficVisible, setTrafficVisible] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  // Lets the rider dismiss the location gate and plan a route manually
  // (type addresses / pick on the map) without granting GPS — live
  // location is only strictly required once the ride is actually active.
  const [gateDismissed, setGateDismissed] = useState(false);

  // Nearby riders (simulated) shown as dots on the map so the planner
  // surfaces who's around before you start. Anchored to the live fix
  // when available, otherwise to the fallback region so the demo always
  // shows a few riders.
  const riderBase = coords ?? {
    latitude: FALLBACK_REGION.latitude,
    longitude: FALLBACK_REGION.longitude,
  };
  const nearbyRiders = useMemo(
    () => getNearbyRiders(coords ?? null),
    [coords],
  );

  // ── Camera: center on user once we get a fix.
  useEffect(() => {
    if (coords && !cameraCenteredRef.current) {
      cameraCenteredRef.current = true;
      mapRef.current?.animateCamera(
        { center: coords, zoom: 15 },
        { duration: 600 },
      );
    }
  }, [coords]);

  // ── Auto-fill the FROM input with live GPS until the user overrides it.
  useEffect(() => {
    if (!coords) return;
    setOrigin((prev) => {
      if (prev.source === 'manual') return prev;
      return { query: 'Current location', coords, source: 'auto' };
    });
  }, [coords]);

  // ── Route building: any time both endpoints have coords, fetch directions.
  useEffect(() => {
    if (!origin.coords || !destination.coords) {
      setRouteState({ kind: 'idle' });
      return;
    }

    directionsAbortRef.current?.abort();
    const ctrl = new AbortController();
    directionsAbortRef.current = ctrl;

    setRouteState({ kind: 'loading' });
    getCyclingDirections(origin.coords, destination.coords, ctrl.signal)
      .then((route) => {
        if (ctrl.signal.aborted) return;
        setRouteState({ kind: 'ready', route });
        mapRef.current?.fitToCoordinates(route.coordinates, {
          edgePadding: {
            top: insets.top + spacing['3xl'],
            bottom: insets.bottom + spacing['5xl'] + spacing['3xl'],
            left: spacing['2xl'],
            right: spacing['2xl'],
          },
          animated: true,
        });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        const message = e instanceof Error ? e.message : 'Unable to build route.';
        setRouteState({ kind: 'error', message });
        toast.error('Route build failed', { text2: message });
      });

    return () => ctrl.abort();
  }, [
    origin.coords,
    destination.coords,
    insets.top,
    insets.bottom,
  ]);

  // ── Smart panel (mode B): derive a destination recommendation from the
  // manual planner's directions result while the panel is open.
  useEffect(() => {
    if (!smartOpen) return;
    if (routeState.kind === 'ready') {
      const cand = directionsToCandidate(routeState.route, {
        id: 'dest-best', name: destination.query || 'Your route',
        difficulty: 'MODERATE', paceKmh: profile.avgPaceKmh,
      });
      const fit = scoreTodayFit(cand, { conditions, profile });
      setDestRecs([{ candidate: cand, fit }]);
      setDestLoading(false);
    } else if (routeState.kind === 'loading') {
      setDestLoading(true);
    }
  }, [smartOpen, routeState, destination.query, profile, conditions]);

  // ── Autocomplete (debounced) — driven by the active input's query.
  useEffect(() => {
    const active = activeField === 'origin' ? origin : activeField === 'destination' ? destination : null;
    if (!active) return;

    const q = active.query.trim();
    // If the active field is showing a coords-backed value (e.g. "Current
    // location" or a picked address) and the user hasn't typed anything new,
    // suppress predictions so we don't immediately query for the label.
    if (active.source !== 'manual' || q.length < 2) {
      setPredictions([]);
      setSearching(false);
      searchAbortRef.current?.abort();
      return;
    }

    setSearching(true);
    const handle = setTimeout(() => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;

      autocompletePlaces(q, coords ?? undefined, ctrl.signal)
        .then((results) => {
          if (!ctrl.signal.aborted) setPredictions(results);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          if (__DEV__) console.warn('[autocomplete]', err);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [activeField, origin, destination, coords]);

  // ── Helpers ───────────────────────────────────────────────────────────

  const formatPinLabel = useCallback((c: LatLng) => {
    return `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;
  }, []);

  /** Best-effort reverse geocoding — free via expo-location. */
  const reverseGeocode = useCallback(async (c: LatLng): Promise<string> => {
    try {
      const results = await Location.reverseGeocodeAsync(c);
      const r = results[0];
      if (!r) return formatPinLabel(c);
      const line1 = [r.streetNumber, r.street].filter(Boolean).join(' ').trim();
      const line2 = [r.city ?? r.subregion, r.region].filter(Boolean).join(', ').trim();
      return [line1, line2].filter(Boolean).join(', ') || formatPinLabel(c);
    } catch {
      return formatPinLabel(c);
    }
  }, [formatPinLabel]);

  // ── Setters ───────────────────────────────────────────────────────────

  const applyEndpoint = useCallback(
    (which: Field, next: Endpoint) => {
      if (which === 'origin') setOrigin(next);
      else setDestination(next);
    },
    [],
  );

  const handleQueryChange = useCallback(
    (which: Field, query: string) => {
      applyEndpoint(which, { query, coords: null, source: 'manual' });
    },
    [applyEndpoint],
  );

  const handleClearField = useCallback(
    (which: Field) => {
      if (which === 'origin' && coords) {
        // Clearing FROM with GPS available → snap back to live current location.
        applyEndpoint('origin', { query: 'Current location', coords, source: 'auto' });
      } else {
        applyEndpoint(which, EMPTY_ENDPOINT);
      }
      setPredictions([]);
    },
    [applyEndpoint, coords],
  );

  const handleSelectPrediction = useCallback(
    async (which: Field, prediction: PlacePrediction) => {
      Keyboard.dismiss();
      setActiveField(null);
      setPredictions([]);
      // Optimistic display before Place Details resolves.
      applyEndpoint(which, {
        query: prediction.primaryText,
        coords: null,
        source: 'manual',
      });
      try {
        const details = await getPlaceDetails(prediction.placeId);
        applyEndpoint(which, {
          query: details.name,
          coords: details.location,
          source: 'manual',
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unable to load place.';
        setRouteState({ kind: 'error', message });
      }
    },
    [applyEndpoint],
  );

  const handleEnterPickOnMap = useCallback((which: Field) => {
    setPickOnMap(which);
    setActiveField(null);
    setPredictions([]);
    Keyboard.dismiss();
  }, []);

  const handleCancelPickOnMap = useCallback(() => {
    setPickOnMap(null);
  }, []);

  const handleMapPress = useCallback(
    async (e: MapPressEvent) => {
      if (navigating) return;
      const c = e.nativeEvent.coordinate;
      const target: Field = pickOnMap ?? 'destination';

      // Provisional value with coords + a coordinate label.
      applyEndpoint(target, {
        query: formatPinLabel(c),
        coords: { latitude: c.latitude, longitude: c.longitude },
        source: 'manual',
      });
      setPickOnMap(null);
      setActiveField(null);

      // Upgrade the label asynchronously to a human-readable address.
      const label = await reverseGeocode({
        latitude: c.latitude,
        longitude: c.longitude,
      });
      applyEndpoint(target, {
        query: label,
        coords: { latitude: c.latitude, longitude: c.longitude },
        source: 'manual',
      });
    },
    [navigating, pickOnMap, applyEndpoint, formatPinLabel, reverseGeocode],
  );

  /** Long-press is a power-user shortcut — sets origin from anywhere. */
  const handleMapLongPress = useCallback(
    async (e: LongPressEvent) => {
      if (navigating) return;
      const c = e.nativeEvent.coordinate;
      applyEndpoint('origin', {
        query: formatPinLabel(c),
        coords: { latitude: c.latitude, longitude: c.longitude },
        source: 'manual',
      });
      const label = await reverseGeocode({
        latitude: c.latitude,
        longitude: c.longitude,
      });
      applyEndpoint('origin', {
        query: label,
        coords: { latitude: c.latitude, longitude: c.longitude },
        source: 'manual',
      });
    },
    [navigating, applyEndpoint, formatPinLabel, reverseGeocode],
  );

  const handleRecenter = useCallback(() => {
    if (!coords) return;
    mapRef.current?.animateCamera({ center: coords, zoom: 16 }, { duration: 400 });
  }, [coords]);

  const handleSwap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const handleStartRide = useCallback(() => {
    if (routeState.kind !== 'ready') return;
    const route = routeState.route;
    setNavigating(true);
    setActiveField(null);
    Keyboard.dismiss();
    startRide({
      routeName: destination.query || route.endAddress || 'Planned ride',
      routeCoordinates: route.coordinates,
      routeDistanceMeters: route.distanceMeters,
      origin: origin.coords ?? route.coordinates[0],
      destination: destination.coords ?? route.coordinates[route.coordinates.length - 1],
      fallbackPaceKmh:
        route.durationSeconds > 0
          ? (route.distanceMeters / route.durationSeconds) * 3.6
          : 28,
    });
    toast.success('Ride started', { text2: route.distanceText + ' planned' });
    router.push('/ride/active' as Href);
  }, [destination, origin.coords, routeState, startRide]);

  const handleRetryRoute = useCallback(() => {
    if (!origin.coords || !destination.coords) return;
    // Bump destination ref to retrigger the effect.
    setDestination({ ...destination });
  }, [origin.coords, destination]);

  const showPermissionGate =
    (locStatus === 'denied' || locStatus === 'unavailable') && !gateDismissed;

  // Toast once when permission is denied — the inline gate explains how
  // to recover, but a top toast gives an immediate, unmissable cue.
  useEffect(() => {
    if (showPermissionGate) {
      toast.error('Location permission required', {
        text2: 'Enable it in Settings to plan a ride.',
      });
    }
  }, [showPermissionGate]);

  const showRouteSummary =
    routeState.kind === 'loading' ||
    routeState.kind === 'ready' ||
    routeState.kind === 'error';

  // Predictions render below the active field, so attach pointer events
  // accordingly to keep the keyboard responsive.
  const showPredictions = activeField !== null && predictions.length > 0;

  // ──────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        ref={mapRef}
        provider={MAP_PROVIDER}
        style={StyleSheet.absoluteFill}
        customMapStyle={darkMapStyle}
        initialRegion={FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={trafficVisible}
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
      >
        {nearbyRiders.map((rider) => {
          const pos = offsetCoords(
            riderBase,
            rider.distanceMeters,
            compassBearing(rider.compass),
          );
          return (
            <Marker
              key={rider.id}
              coordinate={pos}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.riderMarker}>
                <View
                  style={[
                    styles.riderDot,
                    { backgroundColor: draftPotentialColor(rider.potential) },
                  ]}
                />
                <Text style={styles.riderLabel}>{rider.name}</Text>
              </View>
            </Marker>
          );
        })}

        {origin.source === 'manual' && origin.coords && (
          <Marker coordinate={origin.coords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.originPin}>
              <View style={styles.originPinInner} />
              <View style={styles.originPinTail} />
            </View>
          </Marker>
        )}

        {destination.coords && (
          <Marker coordinate={destination.coords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <View style={styles.destPinInner}>
                <MapPoint size={14} color={colors.textOnPrimary} />
              </View>
              <View style={styles.destPinTail} />
            </View>
          </Marker>
        )}

        {routeState.kind === 'ready' && (
          <>
            <Polyline
              coordinates={routeState.route.coordinates}
              strokeColor={colors.background}
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            <Polyline
              coordinates={routeState.route.coordinates}
              strokeColor={colors.primary}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
          </>
        )}
      </MapView>

      {/* Top: just the back button — no top search anymore. */}
      <View
        style={[
          styles.topArea,
          { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={spacing.sm}
        >
          <ArrowLeft size={20} color={colors.textOnDark} />
        </Pressable>
      </View>

      {/* Pick-on-map mode banner */}
      {pickOnMap && (
        <View
          style={[
            styles.pickBanner,
            { top: insets.top + spacing['4xl'] + spacing.xs },
          ]}
        >
          <View style={styles.pickBannerDot} />
          <Text style={styles.pickBannerText}>
            {pickOnMap === 'origin'
              ? 'Tap on map to set origin'
              : 'Tap on map to set destination'}
          </Text>
          <Pressable onPress={handleCancelPickOnMap} hitSlop={spacing.xs}>
            <Text style={styles.pickBannerCancel}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/*
       * Right-side floating action stack (traffic + my-location). Anchors
       * above the bottom sheet via the measured `sheetHeight`.
       */}
      <View
        style={[
          styles.sideStack,
          {
            right: spacing.lg,
            bottom: insets.bottom + sheetHeight + spacing.md,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setTrafficVisible((v) => !v)}
          style={[styles.sideButton, trafficVisible && styles.sideButtonActive]}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={
            trafficVisible ? 'Hide traffic layer' : 'Show traffic layer'
          }
          accessibilityState={{ selected: trafficVisible }}
        >
          <Routing2
            size={20}
            color={trafficVisible ? colors.textOnPrimary : colors.textOnDark}
          />
        </Pressable>
        <Pressable
          onPress={handleRecenter}
          style={[styles.sideButton, !coords && styles.sideButtonDisabled]}
          hitSlop={spacing.xs}
          disabled={!coords}
          accessibilityRole="button"
          accessibilityLabel="Recenter map on me"
        >
          <Gps size={20} color={coords ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {showPermissionGate && (
        <PermissionGate
          message={locError ?? 'Location permission required.'}
          onRetry={retry}
          onPlanWithoutGps={() => setGateDismissed(true)}
          sheetHeight={sheetHeight}
        />
      )}

      <BottomSheet
        insetBottom={insets.bottom}
        origin={origin}
        destination={destination}
        activeField={activeField}
        predictions={predictions}
        searching={searching}
        showPredictions={showPredictions}
        showRouteSummary={showRouteSummary}
        routeState={routeState}
        navigating={navigating}
        trafficVisible={trafficVisible}
        originInputRef={originInputRef}
        destInputRef={destInputRef}
        onFocusField={setActiveField}
        onChangeQuery={handleQueryChange}
        onClearField={handleClearField}
        onSelectPrediction={handleSelectPrediction}
        onPickOnMap={handleEnterPickOnMap}
        onSwap={handleSwap}
        onStart={handleStartRide}
        onRetryRoute={handleRetryRoute}
        onLayout={setSheetHeight}
      />

      {!smartOpen && !navigating && (
        <View
          style={[
            styles.smartBannerWrap,
            { bottom: insets.bottom + sheetHeight + spacing.md },
          ]}
          pointerEvents="box-none"
        >
          <SmartBanner onPress={() => setSmartOpen(true)} />
        </View>
      )}
      {smartOpen && (
        <View
          style={[
            styles.smartPanelWrap,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
          pointerEvents="box-none"
        >
          <SmartPanel
            catalog={catalog}
            origin={origin.coords}
            conditions={conditions}
            profile={profile}
            destinationRecs={destRecs}
            destinationLoading={destLoading}
            onRequestDestination={() => destInputRef.current?.focus()}
            onStart={(candidate) => {
              setSmartOpen(false);
              startRide({
                routeName: candidate.name,
                routeCoordinates: candidate.coordinates,
                routeDistanceMeters: candidate.distanceKm * 1000,
                origin: candidate.origin,
                destination: candidate.destination,
                fallbackPaceKmh: candidate.paceKmh,
              });
              toast.success('Ride started', { text2: `${candidate.distanceKm} km route` });
              router.push('/ride/active' as Href);
            }}
            onClose={() => setSmartOpen(false)}
          />
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles — tokens only. Cards all use `colors.surfaceElevated` (#1F1F1F)
// for visual consistency. Borders in `colors.inactiveOnDark` provide
// hierarchy without nested fills.
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Top
  topArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Pick-on-map mode banner
  pickBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pickBannerDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pickBannerText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
  },
  pickBannerCancel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },

  // Right-side floating action stack
  sideStack: {
    position: 'absolute',
    gap: spacing.sm,
  },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sideButtonActive: {
    backgroundColor: colors.primary,
  },
  sideButtonDisabled: {
    opacity: 0.5,
  },

  // Smart route planning banner + panel
  smartBannerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  smartPanelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  // Nearby-rider markers — small coloured dot + handle, low visual
  // weight so they read as ambient context, not waypoints.
  riderMarker: {
    alignItems: 'center',
    gap: 2,
  },
  riderDot: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.background,
  },
  riderLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textShadowColor: colors.background,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Pins
  destPin: {
    alignItems: 'center',
  },
  destPinInner: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  destPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    marginTop: -2,
  },
  originPin: {
    alignItems: 'center',
  },
  originPinInner: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 4,
    borderColor: colors.textOnDark,
  },
  originPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.textOnDark,
    marginTop: -2,
  },
});
