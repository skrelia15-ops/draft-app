import { useUserLocation } from '@/hooks/useUserLocation';
import { darkMapStyle, ODESSA } from '@/lib/maps';
import {
    buildRoutePreview,
    deriveConditions,
    useRide,
} from '@/lib/ride';
import { useWeather } from '@/lib/weather';
import {
    hashIdSeed,
    shapeLabel,
    trafficColor,
    trafficLabel,
    useRoutes,
} from '@/lib/routes';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { Bolt } from '@solar-icons/react-native/Bold';
import {
    ArrowLeft,
    ArrowRight,
    Compass,
    InfoCircle,
    Routing2,
    UsersGroupTwoRounded,
} from '@solar-icons/react-native/Linear';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FALLBACK_WEATHER = {
  windKmh: 0, windDeg: 0, windFrom: 'N' as const, tempC: 0, feelsLikeC: 0,
  isRaining: false, rainMmLastHour: 0, observedAt: 0,
};

/**
 * Detail view for a single saved/discovered route.
 *
 * Receives `id` as a query param from the screen that linked here
 * (Explore card, Home riders-nearby list, Groups suggestion). If the id
 * is missing or unknown we fall back to the first route in the catalog
 * so the screen never renders empty — this only happens via deep links.
 */
export default function RouteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const { coords } = useUserLocation();
  const { startRide } = useRide();
  const { findRoute } = useRoutes();

  const route = findRoute(params.id);
  const origin = coords ?? ODESSA;

  const { weather } = useWeather();
  const conditions = useMemo(
    () => deriveConditions(weather ?? FALLBACK_WEATHER),
    [weather],
  );

  const preview = useMemo(
    () =>
      route
        ? buildRoutePreview({
            origin,
            shape: route.shape,
            distanceKm: route.distanceKm,
            seed: hashIdSeed(route.id),
          })
        : null,
    [origin, route],
  );

  const region = useMemo(() => {
    if (!preview) return null;
    const lats = preview.coordinates.map((c) => c.latitude);
    const lngs = preview.coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.005, (maxLng - minLng) * 1.4),
    };
  }, [preview]);

  // Catalog still loading or unknown id — render nothing rather than crash.
  if (!route || !preview || !region) return null;

  const estDurationMin = Math.round((route.distanceKm / route.paceKmh) * 60);

  const handleStart = () => {
    startRide({
      routeName: route.name,
      routeCoordinates: preview.coordinates,
      routeDistanceMeters: route.distanceKm * 1000,
      origin: preview.origin,
      destination: preview.destination,
      fallbackPaceKmh: route.paceKmh,
    });
    toast.success('Ride started', { text2: `${route.distanceKm} km route` });
    router.push('/ride/active' as Href);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerKicker}>{shapeLabel(route.shape).toUpperCase()}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {route.name}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            customMapStyle={darkMapStyle}
            region={region}
            pointerEvents="none"
            showsUserLocation={false}
            toolbarEnabled={false}
            showsCompass={false}
            showsMyLocationButton={false}
            showsPointsOfInterest={false}
            showsBuildings={false}
          >
            <Polyline
              coordinates={preview.coordinates}
              strokeColor={colors.background}
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            <Polyline
              coordinates={preview.coordinates}
              strokeColor={colors.primary}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
            <Marker coordinate={preview.origin} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.startPin}>
                <View style={styles.startPinInner} />
              </View>
            </Marker>
            {route.shape !== 'loop' && (
              <Marker coordinate={preview.destination} anchor={{ x: 0.5, y: 1 }}>
                <View style={styles.endPin} />
              </Marker>
            )}
            {route.shape === 'loop' && preview.joinPoint && (
              <Marker
                coordinate={preview.joinPoint}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.joinPin}>
                  <Compass size={14} color={colors.textOnPrimary} />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        {/* Pills row — the only "highlighted" element on the screen.
            Everything else is text + dividers per the design rule. */}
        <View style={styles.tagRow}>
          <Tag
            icon={<Bolt size={14} color={colors.textOnDark} />}
            label={`${route.draftPercent}% draft`}
          />
          <Tag
            icon={<UsersGroupTwoRounded size={14} color={colors.textOnDark} />}
            label={`${route.riders} riders`}
          />
          <Tag
            icon={
              <View
                style={[
                  styles.trafficDot,
                  { backgroundColor: trafficColor(route.traffic) },
                ]}
              />
            }
            label={`Traffic ${trafficLabel(route.traffic)}`}
          />
          <Tag
            icon={<Routing2 size={14} color={colors.textOnDark} />}
            label={route.difficulty.toLowerCase()}
          />
        </View>

        {/* Headline stats as a divider list — no card chrome. */}
        <StatRow label="Distance" value={`${route.distanceKm} km`} />
        <StatRow label="Est. time" value={formatDuration(estDurationMin)} />
        <StatRow label="Est. pace" value={`${route.paceKmh} km/h`} />
        <StatRow
          label="Shape"
          value={`${shapeLabel(route.shape)} — ${shapeBlurb(route.shape)}`}
          /* `Shape` is the rebuilt "what to expect": a single inline row
             that combines the shape label and a one-line description.
             Replaces the previous WHAT TO EXPECT card that took up
             huge area for the same content. */
          multilineValue
        />
        <StatRow
          label="Wind"
          value={`${conditions.windKmh} km/h · ${conditions.windFrom}`}
        />
        <StatRow
          label="Draft index"
          value={`${conditions.draftIndex}%`}
          hint={conditions.draftAdvice}
        />

        {route.note && (
          <View style={styles.noteRow}>
            <InfoCircle size={14} color={colors.textMuted} />
            <Text style={styles.noteText}>{route.note}</Text>
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[
          styles.primaryButton,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
        onPress={handleStart}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>START THIS ROUTE</Text>
        <ArrowRight size={20} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

/**
 * Single text row + hairline divider. The whole screen below the pill
 * row is built from these, so the layout is purely typography +
 * dividers (no card chrome).
 */
function StatRow({
  label,
  value,
  hint,
  multilineValue,
}: {
  label: string;
  value: string;
  /** Optional secondary line shown muted below the value. */
  hint?: string;
  /** Allow the value text to wrap onto multiple lines. */
  multilineValue?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <View style={styles.statRowBody}>
        <Text
          style={[styles.statRowValue, multilineValue && styles.statRowValueWrap]}
          numberOfLines={multilineValue ? undefined : 1}
        >
          {value}
        </Text>
        {hint ? <Text style={styles.statRowHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.tag}>
      {icon}
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}

function shapeBlurb(shape: ReturnType<typeof shapeLabel> extends string ? string : never): string {
  switch (shape as string) {
    case 'Loop':
      return 'A closed circuit that returns you to the start. Best for fixed-time sessions and predictable drafting rotations.';
    case 'Out & back':
      return 'Ride to a turnaround point and return the same way. Wind shift helps on one leg, hurts on the other — plan effort accordingly.';
    case 'Point to point':
      return 'One-way ride that ends at a different location. Arrange your return or schedule pickup at the finish.';
    default:
      return '';
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerKicker: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  headerTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    letterSpacing: typography.letterSpacing.wide,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: spacing.xl,
  },
  mapWrap: {
    height: 240,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  startPin: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.textOnDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  startPinInner: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  endPin: {
    width: 16,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  joinPin: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  // Divider-list stat row — replaces both the old "hero stats" card
  // and the WHAT TO EXPECT card. Label on the left, value on the
  // right, hairline divider underneath.
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  statRowLabel: {
    width: 90,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  statRowBody: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statRowValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    textAlign: 'right',
  },
  statRowValueWrap: {
    textAlign: 'right',
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  statRowHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
    textAlign: 'right',
  },
  // Tag chips
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tagLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'capitalize',
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  noteText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontStyle: 'italic',
    fontSize: typography.size.xs,
  },
  // CTA
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
});
