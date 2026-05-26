import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import MapView, { Polyline, PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import {
  Magnifier,
  Map as MapIcon,
  AltArrowRight,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import { darkMapStyle, type LatLng } from '@/lib/maps';
import { useUserLocation } from '@/hooks/useUserLocation';
import {
  buildRoutePreview,
  getCurrentConditions,
  trafficWeight,
  type RouteShape,
  type TrafficLevel,
} from '@/lib/ride';
import {
  ElevatedCard,
  IconButton,
  ListItemCard,
  PrimaryCard,
  ui,
} from '@/components/ui/draft';

const TAB_BAR_SAFE_AREA = 110;

const FILTERS = ['WITH DRAFT', 'SCENIC', 'POPULAR', 'PERFORMANCE', 'EASY'] as const;
type ExploreFilter = (typeof FILTERS)[number];

type ExploreRoute = {
  id: string;
  name: string;
  distanceKm: number;
  draftPercent: number;
  riders: number;
  shape: RouteShape;
  traffic: TrafficLevel;
  paceKmh: number;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
};

const ROUTES: ExploreRoute[] = [
  {
    id: 'coastal',
    name: 'COASTAL SLIPSTREAM',
    distanceKm: 24.5,
    draftPercent: 92,
    riders: 8,
    shape: 'point-to-point',
    traffic: 'CLEAR',
    paceKmh: 32,
    difficulty: 'MODERATE',
  },
  {
    id: 'urban',
    name: 'URBAN DRAFT LOOP',
    distanceKm: 12.2,
    draftPercent: 88,
    riders: 15,
    shape: 'loop',
    traffic: 'MODERATE',
    paceKmh: 28,
    difficulty: 'EASY',
  },
  {
    id: 'mountain',
    name: 'MOUNTAIN PASS',
    distanceKm: 35.0,
    draftPercent: 78,
    riders: 4,
    shape: 'out-and-back',
    traffic: 'CLEAR',
    paceKmh: 24,
    difficulty: 'HARD',
  },
];

const FILTER_SECTION_LABEL: Record<ExploreFilter, string> = {
  'WITH DRAFT': 'TOP DRAFT ROUTES',
  SCENIC: 'SCENIC ROUTES',
  POPULAR: 'POPULAR ROUTES',
  PERFORMANCE: 'HIGH-INTENSITY ROUTES',
  EASY: 'EASY ROUTES',
};

const MANHATTAN: LatLng = { latitude: 40.7484, longitude: -73.9857 };

function hashIdSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function shapeLabel(s: RouteShape): string {
  if (s === 'loop') return 'Loop';
  if (s === 'out-and-back') return 'Out & back';
  return 'Point to point';
}

function filterRoutes(routes: ExploreRoute[], filter: ExploreFilter): ExploreRoute[] {
  const copy = [...routes];
  switch (filter) {
    case 'WITH DRAFT':
      return copy.sort((a, b) => b.draftPercent - a.draftPercent);
    case 'SCENIC':
      return copy.sort(
        (a, b) =>
          trafficWeight(a.traffic) - trafficWeight(b.traffic) ||
          b.distanceKm - a.distanceKm,
      );
    case 'POPULAR':
      return copy.sort((a, b) => b.riders - a.riders);
    case 'PERFORMANCE':
      return copy.sort((a, b) => b.paceKmh - a.paceKmh);
    case 'EASY':
      return copy
        .filter((r) => r.difficulty === 'EASY' || r.paceKmh <= 28)
        .sort((a, b) => a.paceKmh - b.paceKmh);
    default:
      return copy;
  }
}

function RouteMiniMap({
  preview,
  featured,
}: {
  preview: ReturnType<typeof buildRoutePreview>;
  featured?: boolean;
}) {
  return (
    <View style={[styles.routeMiniMap, featured && styles.routeMiniMapFeatured]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={darkMapStyle}
        region={previewRegion(preview)}
        pointerEvents="none"
        toolbarEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
      >
        <Polyline
          coordinates={preview.coordinates}
          strokeColor={featured ? colors.textOnDark : colors.textMuted}
          strokeWidth={featured ? 3 : 2.5}
          lineCap="round"
          lineJoin="round"
        />
      </MapView>
    </View>
  );
}

function RouteCardBody({ route, featured }: { route: ExploreRoute; featured?: boolean }) {
  return (
    <>
      <Text style={[styles.routeName, featured && styles.routeNameFeatured]}>{route.name}</Text>
      <Text style={styles.routeMetaLine}>
        {route.distanceKm} km · {shapeLabel(route.shape)}
      </Text>
      <Text style={styles.routeDraftScore}>{route.draftPercent}% draft potential</Text>
      <Text style={styles.routeRidersSecondary}>{route.riders} riders nearby</Text>
    </>
  );
}

export default function ExploreScreen() {
  const { coords } = useUserLocation();
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>('WITH DRAFT');
  const conditions = useMemo(() => getCurrentConditions(), []);
  const origin = coords ?? MANHATTAN;

  const filteredRoutes = useMemo(
    () => filterRoutes(ROUTES, activeFilter),
    [activeFilter],
  );

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ed8cb'},body:JSON.stringify({sessionId:'1ed8cb',location:'app/(tabs)/explore.tsx:mount',message:'ExploreScreen mounted',data:{activeFilter,routeCount:filteredRoutes.length,hasCoords:!!coords},timestamp:Date.now(),hypothesisId:'D',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
  }, [activeFilter, filteredRoutes.length, coords]);

  const previewById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildRoutePreview>>();
    for (const route of ROUTES) {
      map.set(
        route.id,
        buildRoutePreview({
          origin,
          shape: route.shape,
          distanceKm: route.distanceKm,
          seed: hashIdSeed(route.id),
        }),
      );
    }
    return map;
  }, [origin]);

  const overviewPreview = useMemo(
    () =>
      buildRoutePreview({
        origin,
        shape: 'loop',
        distanceKm: 20,
        seed: 12345,
      }),
    [origin],
  );

  const region = useMemo(() => {
    const lats = overviewPreview.coordinates.map((c) => c.latitude);
    const lngs = overviewPreview.coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.6),
    };
  }, [overviewPreview]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>EXPLORE</Text>
          <Text style={styles.headerSub}>Where to ride</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            onPress={() => router.push('/ride/map' as Href)}
            accessibilityLabel="Search destination"
            icon={<Magnifier size={20} color={colors.textOnDark} />}
          />
          <IconButton
            onPress={() => router.push('/ride/map' as Href)}
            accessibilityLabel="Open map"
            icon={<MapIcon size={20} color={colors.textOnDark} />}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map((label) => {
          const active = label === activeFilter;
          return (
            <Pressable
              key={label}
              style={[styles.filter, active && styles.filterActive]}
              onPress={() => setActiveFilter(label)}
            >
              <Text style={[styles.filterText, active && styles.filterActiveText]}>
                {label}
              </Text>
              {active && <View style={styles.filterUnderline} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ElevatedCard
        style={styles.mapPreviewWrap}
        onPress={() => router.push('/ride/map' as Href)}
      >
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          customMapStyle={darkMapStyle}
          region={region}
          pointerEvents="none"
          toolbarEnabled={false}
          showsCompass={false}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
        >
          <Polyline
            coordinates={overviewPreview.coordinates}
            strokeColor={colors.background}
            strokeWidth={8}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            coordinates={overviewPreview.coordinates}
            strokeColor={colors.textOnDark}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
          <Marker coordinate={overviewPreview.origin} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.startPin}>
              <View style={styles.startPinInner} />
            </View>
          </Marker>
        </MapView>
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            Draft index {conditions.draftIndex}% · {conditions.windKmh} km/h {conditions.windFrom}
          </Text>
        </View>
        <View style={styles.mapCtaRow}>
          <Text style={styles.mapCta}>Open interactive map</Text>
          <AltArrowRight size={16} color={colors.textOnDark} />
        </View>
      </ElevatedCard>

      <Text style={styles.sectionTitle}>{FILTER_SECTION_LABEL[activeFilter]}</Text>

      {filteredRoutes.length === 0 ? (
        <PrimaryCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No routes match this filter</Text>
          <Text style={styles.emptyBody}>Try another tab to see more options nearby.</Text>
        </PrimaryCard>
      ) : (
        filteredRoutes.map((route, index) => {
          const preview = previewById.get(route.id)!;
          const featured = index === 0;

          if (featured) {
            return (
              <ElevatedCard
                key={route.id}
                style={styles.featuredRouteCard}
                onPress={() => router.push('/ride/route-details' as Href)}
              >
                <View style={styles.featuredRow}>
                  <RouteMiniMap preview={preview} featured />
                  <View style={styles.featuredBody}>
                    <RouteCardBody route={route} featured />
                  </View>
                  <AltArrowRight size={20} color={colors.textMuted} />
                </View>
              </ElevatedCard>
            );
          }

          return (
            <ListItemCard
              key={route.id}
              style={styles.routeCard}
              onPress={() => router.push('/ride/route-details' as Href)}
              leading={<RouteMiniMap preview={preview} />}
              trailing={<AltArrowRight size={20} color={colors.textMuted} />}
            >
              <RouteCardBody route={route} />
            </ListItemCard>
          );
        })
      )}
    </ScrollView>
  );
}

function previewRegion(preview: ReturnType<typeof buildRoutePreview>) {
  const lats = preview.coordinates.map((c) => c.latitude);
  const lngs = preview.coordinates.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing['4xl'],
    paddingBottom: TAB_BAR_SAFE_AREA,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  headerSub: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filtersScroll: {
    marginBottom: spacing.xl,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: 'rgba(255,255,255,0.12)',
    ...ui.softShadow,
  },
  filterUnderline: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing['2xs'],
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.textOnDark,
  },
  filterText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  filterActiveText: {
    color: colors.textOnDark,
  },
  mapPreviewWrap: {
    marginHorizontal: spacing.lg,
    height: 200,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    padding: 0,
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
  mapBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapBadgeText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  mapCtaRow: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  mapCta: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  featuredRouteCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featuredBody: {
    flex: 1,
  },
  routeCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  routeMiniMap: {
    width: 64,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  routeMiniMapFeatured: {
    width: 72,
    height: 58,
  },
  routeName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  routeNameFeatured: {
    fontSize: typography.size.base,
  },
  routeMetaLine: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginBottom: spacing['3xs'],
  },
  routeDraftScore: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    marginBottom: spacing['3xs'],
  },
  routeRidersSecondary: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    marginBottom: spacing['2xs'],
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
});
