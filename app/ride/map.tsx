import {
  AltArrowRight,
  ArrowLeft,
  ArrowRight,
  CloseCircle,
  DangerCircle,
  Gps,
  MapPoint,
  Routing2,
  TransferVertical,
} from '@solar-icons/react-native/Linear';
import * as Location from 'expo-location';
import { router, Stack, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
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
  type RouteResult,
} from '@/lib/maps';
import {
  draftPotentialColor,
  getNearbyRiders,
  trafficLevelColor,
  useRide,
  type DraftPotential,
} from '@/lib/ride';
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

/** A resolved waypoint — either a typed/picked place or auto-detected GPS. */
type Endpoint = {
  /** What the user sees in the input. */
  query: string;
  /** Coordinates. `null` while the user is typing but hasn't picked yet. */
  coords: LatLng | null;
  /**
   * `'auto'` = live current location (the value follows GPS).
   * `'manual'` = user typed / picked a value (decoupled from GPS).
   * `'empty'` = nothing yet.
   */
  source: 'auto' | 'manual' | 'empty';
};

const EMPTY_ENDPOINT: Endpoint = { query: '', coords: null, source: 'empty' };

type RouteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; route: RouteResult }
  | { kind: 'error'; message: string };

/**
 * Which input is currently active (focused or in pick-on-map mode).
 * Drives both the predictions dropdown and the map-tap routing.
 */
type Field = 'origin' | 'destination';

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
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Nearby-rider helpers
// ────────────────────────────────────────────────────────────────────────────

/** Compass label → bearing in degrees (N = 0, clockwise). */
function compassBearing(compass: string): number {
  const map: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };
  return map[compass] ?? 0;
}

/** Project a base coordinate `meters` along `bearingDeg` into a new LatLng. */
function offsetCoords(
  base: LatLng,
  meters: number,
  bearingDeg: number,
): LatLng {
  const R = 6378137; // Earth radius, meters
  const d = meters / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (base.latitude * Math.PI) / 180;
  const lon1 = (base.longitude * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function PermissionGate({
  message,
  onRetry,
  onPlanWithoutGps,
  sheetHeight,
}: {
  message: string;
  onRetry: () => void;
  onPlanWithoutGps: () => void;
  sheetHeight: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.permissionWrap, { paddingHorizontal: spacing.lg }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.permissionCard,
          // Float clearly above the bottom sheet with a gap, so the two
          // dark surfaces don't visually merge into one block.
          { marginBottom: insets.bottom + sheetHeight + spacing.lg },
        ]}
      >
        <View style={styles.permissionIcon}>
          <DangerCircle size={22} color={colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>LOCATION OFF</Text>
        <Text style={styles.permissionBody}>
          {message} You can still plan a route by typing an address or
          tapping the map — GPS is only needed once you start riding.
        </Text>
        <View style={styles.permissionRow}>
          <Pressable style={styles.permissionGhost} onPress={onRetry}>
            <Text style={styles.permissionGhostText}>RETRY</Text>
          </Pressable>
          <Pressable
            style={styles.permissionPrimary}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.permissionPrimaryText}>OPEN SETTINGS</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.permissionDismiss}
          onPress={onPlanWithoutGps}
          accessibilityRole="button"
        >
          <Text style={styles.permissionDismissText}>PLAN WITHOUT GPS</Text>
        </Pressable>
      </View>
    </View>
  );
}

type BottomSheetProps = {
  insetBottom: number;
  origin: Endpoint;
  destination: Endpoint;
  activeField: Field | null;
  predictions: PlacePrediction[];
  searching: boolean;
  showPredictions: boolean;
  showRouteSummary: boolean;
  routeState: RouteState;
  navigating: boolean;
  trafficVisible: boolean;
  originInputRef: React.RefObject<TextInput | null>;
  destInputRef: React.RefObject<TextInput | null>;
  onFocusField: (which: Field | null) => void;
  onChangeQuery: (which: Field, query: string) => void;
  onClearField: (which: Field) => void;
  onSelectPrediction: (which: Field, prediction: PlacePrediction) => void;
  onPickOnMap: (which: Field) => void;
  onSwap: () => void;
  onStart: () => void;
  onRetryRoute: () => void;
  onLayout: (height: number) => void;
};

function BottomSheet(props: BottomSheetProps) {
  const {
    insetBottom,
    origin,
    destination,
    activeField,
    predictions,
    searching,
    showPredictions,
    showRouteSummary,
    routeState,
    navigating,
    trafficVisible,
    originInputRef,
    destInputRef,
    onFocusField,
    onChangeQuery,
    onClearField,
    onSelectPrediction,
    onPickOnMap,
    onSwap,
    onStart,
    onRetryRoute,
    onLayout,
  } = props;

  const wrapStyle = [
    styles.sheetWrap,
    {
      paddingHorizontal: spacing.lg,
      paddingBottom: Math.max(insetBottom, spacing.sm),
    },
  ];

  const startEnabled = routeState.kind === 'ready' && !navigating;

  return (
    <View style={wrapStyle} pointerEvents="box-none">
      <View
        style={styles.sheet}
        onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
      >
        <View style={styles.sheetHandle} />

        {/* FROM input */}
        <InputRow
          which="origin"
          inputRef={originInputRef}
          value={origin.query}
          placeholder="Choose origin"
          dot={<View style={styles.inputDotOrigin} />}
          active={activeField === 'origin'}
          onFocus={() => onFocusField('origin')}
          onBlur={() => {
            // Defer so prediction taps still register.
            setTimeout(() => {
              onFocusField(null);
            }, 100);
          }}
          onChangeText={(t) => onChangeQuery('origin', t)}
          onClear={() => onClearField('origin')}
          onPickOnMap={() => onPickOnMap('origin')}
          showClear={origin.query.length > 0}
        />

        {showPredictions && activeField === 'origin' && (
          <PredictionsList
            predictions={predictions}
            searching={searching}
            onSelect={(p) => onSelectPrediction('origin', p)}
          />
        )}

        {/* Swap */}
        <View style={styles.swapRow}>
          <View style={styles.swapDivider} />
          <Pressable
            onPress={onSwap}
            hitSlop={spacing.xs}
            style={styles.swapButton}
          >
            <TransferVertical size={16} color={colors.textMuted} />
          </Pressable>
          <View style={styles.swapDivider} />
        </View>

        {/* TO input */}
        <InputRow
          which="destination"
          inputRef={destInputRef}
          value={destination.query}
          placeholder="Where to?"
          dot={<View style={styles.inputDotDest} />}
          active={activeField === 'destination'}
          onFocus={() => onFocusField('destination')}
          onBlur={() => {
            setTimeout(() => {
              onFocusField(null);
            }, 100);
          }}
          onChangeText={(t) => onChangeQuery('destination', t)}
          onClear={() => onClearField('destination')}
          onPickOnMap={() => onPickOnMap('destination')}
          showClear={destination.query.length > 0}
        />

        {showPredictions && activeField === 'destination' && (
          <PredictionsList
            predictions={predictions}
            searching={searching}
            onSelect={(p) => onSelectPrediction('destination', p)}
          />
        )}

        {showRouteSummary && (
          <>
            <View style={styles.summarySpacer} />
            <RouteSummary routeState={routeState} trafficVisible={trafficVisible} />
            {routeState.kind === 'error' && (
              <View style={styles.errorRow}>
                <DangerCircle size={16} color={colors.primary} />
                <Text style={styles.errorText} numberOfLines={3}>
                  {routeState.message}
                </Text>
                <Pressable onPress={onRetryRoute} hitSlop={spacing.xs}>
                  <Text style={styles.errorRetry}>RETRY</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            pressed && startEnabled && styles.startButtonPressed,
            !startEnabled && styles.startButtonDisabled,
          ]}
          disabled={!startEnabled}
          onPress={onStart}
        >
          <Text
            style={[
              styles.startButtonText,
              !startEnabled && styles.startButtonTextDisabled,
            ]}
          >
            {navigating ? 'STARTING…' : 'START RIDE'}
          </Text>
          <ArrowRight
            size={20}
            color={startEnabled ? colors.textOnPrimary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

function InputRow({
  inputRef,
  value,
  placeholder,
  dot,
  active,
  onFocus,
  onBlur,
  onChangeText,
  onClear,
  onPickOnMap,
  showClear,
}: {
  which: Field;
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  placeholder: string;
  dot: React.ReactNode;
  active: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (t: string) => void;
  onClear: () => void;
  onPickOnMap: () => void;
  showClear: boolean;
}) {
  return (
    <View style={[styles.inputField, active && styles.inputFieldActive]}>
      {dot}
      <TextInput
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.inputText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {showClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={spacing.xs}
          style={styles.inputAction}
        >
          <CloseCircle size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPickOnMap}
        hitSlop={spacing.xs}
        style={styles.inputAction}
      >
        <MapPoint size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function PredictionsList({
  predictions,
  searching,
  onSelect,
}: {
  predictions: PlacePrediction[];
  searching: boolean;
  onSelect: (p: PlacePrediction) => void;
}) {
  return (
    <View style={styles.predictions}>
      {searching && (
        <View style={styles.predictionsLoading}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      )}
      {predictions.slice(0, 5).map((p) => (
        <Pressable
          key={p.placeId}
          onPress={() => onSelect(p)}
          style={({ pressed }) => [
            styles.predictionRow,
            pressed && styles.predictionRowPressed,
          ]}
        >
          <View style={styles.predictionIcon}>
            <MapPoint size={16} color={colors.primary} />
          </View>
          <View style={styles.predictionBody}>
            <Text style={styles.predictionPrimary} numberOfLines={1}>
              {p.primaryText}
            </Text>
            {!!p.secondaryText && (
              <Text style={styles.predictionSecondary} numberOfLines={1}>
                {p.secondaryText}
              </Text>
            )}
          </View>
          <AltArrowRight size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

function RouteSummary({
  routeState,
  trafficVisible,
}: {
  routeState: RouteState;
  trafficVisible: boolean;
}) {
  /**
   * Traffic level inferred from the duration_in_traffic / duration ratio.
   * Only set for driving routes (Google Directions doesn't return traffic
   * for cycling).
   */
  const traffic = useMemo(() => {
    if (routeState.kind !== 'ready' || !routeState.route.trafficLevel) return null;
    const level = routeState.route.trafficLevel;
    return { level, color: trafficLevelColor(level) };
  }, [routeState]);

  if (routeState.kind === 'loading') {
    return (
      <View style={styles.statsRow}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.statsLoading}>Building route…</Text>
      </View>
    );
  }

  if (routeState.kind !== 'ready') return null;

  const r = routeState.route;
  const eta = r.durationInTrafficText ?? r.durationText;
  const showTrafficDelta =
    !!r.durationInTrafficText &&
    r.durationInTrafficText !== r.durationText &&
    !!traffic &&
    traffic.level !== 'CLEAR';

  return (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>DISTANCE</Text>
          <Text style={styles.statValue}>{r.distanceText}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>ETA</Text>
          <Text style={styles.statValue}>{eta}</Text>
          {showTrafficDelta && (
            <Text style={styles.statSub}>normally {r.durationText}</Text>
          )}
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>MODE</Text>
          <Text style={styles.statValue}>
            {r.mode === 'bicycling' ? 'CYCLE' : r.mode === 'driving' ? 'DRIVE' : 'WALK'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {traffic && (
          <View style={styles.trafficBadge}>
            <View style={[styles.trafficDot, { backgroundColor: traffic.color }]} />
            <Text style={styles.trafficText}>
              TRAFFIC · {traffic.level}
            </Text>
          </View>
        )}
        {traffic?.level === 'HEAVY' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>
              {r.alternativeCount > 0
                ? `${r.alternativeCount} alternate route${r.alternativeCount === 1 ? '' : 's'} available`
                : 'Consider a suggested loop instead'}
            </Text>
          </View>
        )}
        {!traffic && trafficVisible && r.mode === 'bicycling' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>LIVE TRAFFIC LAYER ACTIVE</Text>
          </View>
        )}
        {r.mode !== 'bicycling' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>
              Cycling not available, showing {r.mode} route
            </Text>
          </View>
        )}
      </View>
    </>
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

  // Bottom sheet
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.inactiveOnDark,
    marginBottom: spacing.sm,
  },

  // FROM/TO input rows — single flat surface, border-defined
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  inputFieldActive: {
    borderColor: colors.primary,
  },
  inputDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
    borderWidth: 2,
    borderColor: colors.inactiveOnDark,
  },
  inputDotDest: {
    width: 10,
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: colors.primary,
  },
  inputText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    paddingVertical: spacing.xs,
  },
  inputAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vertical separator + swap
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  swapDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.6,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Predictions
  predictions: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  predictionsLoading: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  predictionRowPressed: {
    backgroundColor: colors.background,
  },
  predictionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  predictionBody: {
    flex: 1,
  },
  predictionPrimary: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  predictionSecondary: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },

  summarySpacer: {
    height: spacing.md,
  },

  // Stats — flat with divider rules
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  statsLoading: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
  },
  statSub: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    marginTop: spacing['3xs'],
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.6,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  trafficBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  trafficText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  fallbackBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  fallbackText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  errorText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  errorRetry: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },

  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  startButtonPressed: {
    opacity: 0.9,
  },
  startButtonDisabled: {
    backgroundColor: colors.inactiveOnDark,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  startButtonTextDisabled: {
    color: colors.textMuted,
  },

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

  // Permission gate
  permissionWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    // Anchor the card to the bottom; its marginBottom lifts it above the
    // sheet so the gate floats just over it with a clear gap.
    justifyContent: 'flex-end',
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(17,17,17,0.5)' : 'rgba(17,17,17,0.6)',
  },
  permissionCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    alignItems: 'center',
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  permissionBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  permissionGhost: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  permissionGhostText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  permissionPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  permissionPrimaryText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  permissionDismiss: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  permissionDismissText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
});
