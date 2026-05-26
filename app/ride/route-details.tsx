import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Bolt } from '@solar-icons/react-native/Bold';
import {
  ArrowLeft,
  UsersGroupTwoRounded,
  InfoCircle,
  Compass,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import { darkMapStyle, type LatLng } from '@/lib/maps';
import { useUserLocation } from '@/hooks/useUserLocation';
import {
  buildRoutePreview,
  useRide,
  type RouteShape,
} from '@/lib/ride';

type RouteOption = {
  id: string;
  name: string;
  distanceKm: number;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  shape: RouteShape;
  paceKmh: number;
  riders: number;
  draftPercent: number;
  traffic: 'CLEAR' | 'MODERATE' | 'HEAVY';
  note?: string;
};

const OPTIONS: RouteOption[] = [
  {
    id: 'coastal',
    name: 'COASTAL SLIPSTREAM',
    distanceKm: 24.5,
    difficulty: 'MODERATE',
    shape: 'point-to-point',
    paceKmh: 32,
    riders: 8,
    draftPercent: 92,
    traffic: 'MODERATE',
    note: 'Best drafting right now',
  },
  {
    id: 'urban',
    name: 'URBAN DRAFT LOOP',
    distanceKm: 12.2,
    difficulty: 'EASY',
    shape: 'loop',
    paceKmh: 28,
    riders: 15,
    draftPercent: 88,
    traffic: 'CLEAR',
  },
  {
    id: 'gravel',
    name: 'GRAVEL TRAIN',
    distanceKm: 35.0,
    difficulty: 'HARD',
    shape: 'out-and-back',
    paceKmh: 24,
    riders: 4,
    draftPercent: 76,
    traffic: 'HEAVY',
  },
];

const MANHATTAN: LatLng = { latitude: 40.7484, longitude: -73.9857 };

function hashIdSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export default function RouteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { startRide } = useRide();
  const [selectedId, setSelectedId] = useState(OPTIONS[0].id);

  const origin = coords ?? MANHATTAN;

  // Precompute previews once per origin — same option always returns the
  // same shape so the map doesn't shuffle on selection changes.
  const previews = useMemo(() => {
    return OPTIONS.map((opt) =>
      buildRoutePreview({
        origin,
        shape: opt.shape,
        distanceKm: opt.distanceKm,
        seed: hashIdSeed(opt.id),
      }),
    );
  }, [origin]);

  const selectedIndex = OPTIONS.findIndex((o) => o.id === selectedId);
  const selected = OPTIONS[selectedIndex];
  const selectedPreview = previews[selectedIndex];

  const region = useMemo(() => {
    if (selectedPreview.coordinates.length === 0) return null;
    const lats = selectedPreview.coordinates.map((c) => c.latitude);
    const lngs = selectedPreview.coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max(0.005, (maxLat - minLat) * 1.4);
    const lngDelta = Math.max(0.005, (maxLng - minLng) * 1.4);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [selectedPreview]);

  const handleStart = () => {
    startRide({
      routeName: selected.name,
      routeCoordinates: selectedPreview.coordinates,
      routeDistanceMeters: selected.distanceKm * 1000,
      origin: selectedPreview.origin,
      destination: selectedPreview.destination,
      fallbackPaceKmh: selected.paceKmh,
    });
    router.push('/ride/active' as Href);
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <View>
          <Text style={styles.destLabel}>LOOP DESTINATION</Text>
          <Text style={styles.destName}>Choose your route</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapWrap}>
          {region && (
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
                coordinates={selectedPreview.coordinates}
                strokeColor={colors.background}
                strokeWidth={10}
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
              <Polyline
                coordinates={selectedPreview.coordinates}
                strokeColor={colors.primary}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
              <Marker coordinate={selectedPreview.origin} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.startPin}>
                  <View style={styles.startPinInner} />
                </View>
              </Marker>
              {selected.shape !== 'loop' && (
                <Marker
                  coordinate={selectedPreview.destination}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.endPin} />
                </Marker>
              )}
              {selected.shape === 'loop' && selectedPreview.joinPoint && (
                <Marker
                  coordinate={selectedPreview.joinPoint}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.joinPin}>
                    <Compass size={14} color={colors.textOnPrimary} />
                  </View>
                </Marker>
              )}
            </MapView>
          )}
          <View style={styles.mapBadge}>
            <View style={styles.mapBadgeDot} />
            <Text style={styles.mapBadgeText}>{shapeLabel(selected.shape)}</Text>
          </View>
        </View>

        <View style={styles.routeSummary}>
          <View>
            <Text style={styles.summaryLabel}>{shapeLabel(selected.shape)}</Text>
            <Text style={styles.summaryName}>{selected.name}</Text>
            <Text style={styles.summaryMeta}>
              {selected.distanceKm} KM · {selected.paceKmh} KM/H · Traffic:{' '}
              {trafficLabel(selected.traffic)}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryStat}>{selected.draftPercent}%</Text>
            <Text style={styles.summaryStatLabel}>DRAFT</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.legendStart} />
            <Text style={styles.legendLabel}>Start</Text>
          </View>
          {selected.shape === 'loop' && (
            <View style={styles.legendItem}>
              <View style={styles.legendJoin} />
              <Text style={styles.legendLabel}>Suggested join point</Text>
            </View>
          )}
          {selected.shape !== 'loop' && (
            <View style={styles.legendItem}>
              <View style={styles.legendEnd} />
              <Text style={styles.legendLabel}>Finish</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>ALL ROUTES</Text>
          <Text style={styles.sectionCount}>{OPTIONS.length} OPTIONS</Text>
        </View>

        {OPTIONS.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <Pressable
              key={option.id}
              style={[styles.routeCard, isSelected && styles.routeCardSelected]}
              onPress={() => setSelectedId(option.id)}
            >
              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>SELECTED</Text>
                </View>
              )}

              <View style={styles.routeTop}>
                <Text style={styles.routeName}>{option.name}</Text>
                <View style={styles.paceBlock}>
                  <Text style={styles.paceValue}>{option.paceKmh} km/h</Text>
                  <Text style={styles.paceLabel}>EST. PACE</Text>
                </View>
              </View>

              <View style={styles.routeMeta}>
                <Text style={styles.routeMetaText}>{option.distanceKm} KM</Text>
                <View style={styles.routeMetaDot} />
                <Text style={styles.routeMetaText}>{option.difficulty}</Text>
                <View style={styles.routeMetaDot} />
                <Text style={styles.routeMetaText}>{shapeLabel(option.shape)}</Text>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStatsRow}>
                <View style={styles.routeStatItem}>
                  <UsersGroupTwoRounded size={16} color={colors.primary} />
                  <Text style={styles.routeStatText}>{option.riders} riders</Text>
                </View>
                <View style={styles.routeStatItem}>
                  <Bolt size={16} color={colors.primary} />
                  <Text style={styles.routeStatText}>{option.draftPercent}% draft</Text>
                </View>
                <View style={styles.routeStatItem}>
                  <View
                    style={[
                      styles.trafficDot,
                      { backgroundColor: trafficColor(option.traffic) },
                    ]}
                  />
                  <Text style={styles.routeStatText}>
                    Traffic: {trafficLabel(option.traffic)}
                  </Text>
                </View>
              </View>

              {option.note && (
                <View style={styles.routeNote}>
                  <InfoCircle size={14} color={colors.textMuted} />
                  <Text style={styles.routeNoteText}>{option.note}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[
          styles.primaryButton,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
        onPress={handleStart}
      >
        <Text style={styles.primaryButtonText}>START THIS ROUTE</Text>
      </Pressable>
    </View>
  );
}

function shapeLabel(shape: RouteShape): string {
  switch (shape) {
    case 'loop':
      return 'LOOP';
    case 'out-and-back':
      return 'OUT & BACK';
    case 'point-to-point':
      return 'POINT TO POINT';
  }
}

function trafficLabel(level: RouteOption['traffic']): string {
  if (level === 'CLEAR') return 'Clear';
  if (level === 'MODERATE') return 'Moderate';
  return 'Heavy';
}

function trafficColor(level: RouteOption['traffic']): string {
  if (level === 'CLEAR') return '#3FBF6E';
  if (level === 'MODERATE') return '#F2A93B';
  return '#E5484D';
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
  destLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  destName: {
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
  mapBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  mapBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  mapBadgeText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
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
  routeSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['2xs'],
  },
  summaryName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginBottom: spacing['3xs'],
  },
  summaryMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryStat: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  summaryStatLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendStart: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.textOnDark,
    borderWidth: 2,
    borderColor: colors.background,
  },
  legendEnd: {
    width: 8,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  legendJoin: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  legendLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  sectionCount: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  routeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  routeCardSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: radius.md,
  },
  selectedBadgeText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  routeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingRight: spacing['4xl'],
  },
  routeName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    flex: 1,
  },
  paceBlock: {
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  paceValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
  },
  paceLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  routeMetaText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  routeMetaDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.5,
    marginBottom: spacing.md,
  },
  routeStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  routeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeStatText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  routeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  routeNoteText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontStyle: 'italic',
    fontSize: typography.size.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
});
