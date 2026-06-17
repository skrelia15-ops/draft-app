import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { router, Href } from 'expo-router';
import MapView, { Polyline } from 'react-native-maps';
import { Search, ChevronRight, XCircle } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { darkMapStyle, MAP_PROVIDER, ODESSA } from '@/lib/maps';
import { useUserLocation } from '@/hooks/useUserLocation';
import { buildRoutePreview } from '@/lib/ride';
import {
  hashIdSeed,
  shapeLabel,
  useRoutes,
  type CatalogRoute,
} from '@/lib/routes';
import {
  IconButton,
  PrimaryCard,
  SegmentedTabs,
} from '@/components/ui/draft';

const TAB_BAR_SAFE_AREA = 110;

// Three filters keep the list scannable and the labels obvious — the
// previous 5-tab strip read as jargon.
const FILTERS = ['ALL', 'POPULAR', 'BY DIFFICULTY'] as const;
type ExploreFilter = (typeof FILTERS)[number];

type ExploreRoute = CatalogRoute;

const FILTER_SECTION_LABEL: Record<ExploreFilter, string> = {
  ALL: 'ALL ROUTES',
  POPULAR: 'MOST RIDERS RIGHT NOW',
  'BY DIFFICULTY': 'EASY TO HARD',
};

const FILTER_SUBTITLE: Record<ExploreFilter, string> = {
  ALL: 'Every route, sorted by drafting potential',
  POPULAR: 'Where other riders are right now',
  'BY DIFFICULTY': 'Beginner-friendly routes first',
};

const DIFFICULTY_RANK: Record<ExploreRoute['difficulty'], number> = {
  EASY: 0,
  MODERATE: 1,
  HARD: 2,
};

function filterRoutes(routes: ExploreRoute[], filter: ExploreFilter): ExploreRoute[] {
  const copy = [...routes];
  switch (filter) {
    case 'ALL':
      return copy.sort((a, b) => b.draftPercent - a.draftPercent);
    case 'POPULAR':
      return copy.sort((a, b) => b.riders - a.riders);
    case 'BY DIFFICULTY':
      return copy.sort(
        (a, b) =>
          DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
          a.paceKmh - b.paceKmh,
      );
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
        provider={MAP_PROVIDER}
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
  const { routes: catalog, isHydrated } = useRoutes();
  const { coords } = useUserLocation();
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>('ALL');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput | null>(null);
  const origin = coords ?? ODESSA;

  /**
   * Apply the active filter first, then narrow further with the
   * search query. When the user is searching we ignore the filter so they
   * can find a route by name even if the wrong filter tab is active.
   */
  const filteredRoutes = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed) {
      return catalog.filter((r) => r.name.toLowerCase().includes(trimmed));
    }
    return filterRoutes(catalog, activeFilter);
  }, [catalog, activeFilter, searchQuery]);

  const previewById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildRoutePreview>>();
    for (const route of catalog) {
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
  }, [catalog, origin]);

  const handleToggleSearch = () => {
    setSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery('');
      // Defer focus a frame so the input is mounted.
      if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
      return next;
    });
  };

  const sectionLabel = searchQuery.trim()
    ? `RESULTS · ${filteredRoutes.length}`
    : FILTER_SECTION_LABEL[activeFilter];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>EXPLORE</Text>
          <Text style={styles.headerSub}>Where to ride</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            onPress={handleToggleSearch}
            accessibilityLabel={searchOpen ? 'Close search' : 'Search routes'}
            selected={searchOpen}
            icon={
              searchOpen ? (
                <XCircle size={20} color={colors.textOnDark} />
              ) : (
                <Search size={20} color={colors.textOnDark} />
              )
            }
          />
        </View>
      </View>

      {searchOpen && (
        <View style={styles.searchShell}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            // Strip the leading space — typing a single space at the
            // start of a search is almost always a fat-finger error and
            // breaks the trim-based "is searching" check below.
            onChangeText={(t) => setSearchQuery(t.replace(/^\s+/, ''))}
            placeholder="Search routes by name"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={spacing.xs}
              accessibilityLabel="Clear search"
            >
              <XCircle size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Hide filter tabs while searching — they don't apply. */}
      {!searchQuery.trim() && (
        <SegmentedTabs
          options={FILTERS}
          value={activeFilter}
          onChange={setActiveFilter}
          contentInsetHorizontal={spacing.lg}
          style={styles.filters}
        />
      )}

      <Text style={styles.sectionTitle}>{sectionLabel}</Text>
      {/* A subtitle behind every active filter — keeps the user oriented
          about WHY routes are sorted the way they are. Hidden during a
          text search since the heading already explains "RESULTS · N". */}
      {!searchQuery.trim() && (
        <Text style={styles.sectionSubtitle}>
          {FILTER_SUBTITLE[activeFilter]}
        </Text>
      )}

      {filteredRoutes.length === 0 ? (
        // Suppress the false-empty state while the catalog is still loading.
        // Only show the empty card once hydrated, or when the user is
        // actively searching (search over a hydrating catalog is fine to
        // show as no-results, but in practice hydration completes first).
        (!isHydrated && !searchQuery.trim()) ? null : (
          <PrimaryCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No routes match your search' : 'No routes match this filter'}
            </Text>
            <Text style={styles.emptyBody}>
              {searchQuery.trim()
                ? 'Try a shorter or different name.'
                : 'Try another tab to see more options nearby.'}
            </Text>
          </PrimaryCard>
        )
      ) : (
        filteredRoutes.map((route) => {
          const preview = previewById.get(route.id)!;
          const detailsHref = `/ride/route-details?id=${route.id}` as Href;
          return (
            <Pressable
              key={route.id}
              accessibilityRole="button"
              onPress={() => router.push(detailsHref)}
              style={({ pressed }) => [
                styles.routeRow,
                pressed && styles.routeRowPressed,
              ]}
            >
              {/* Map sits flush with the card's left/top/bottom edges —
                  no inner padding around it. Only the text block gets
                  the usual padding. */}
              <RouteMiniMap preview={preview} />
              <View style={styles.routeRowBody}>
                <RouteCardBody route={route} />
              </View>
              <View style={styles.routeRowTrailing}>
                <ChevronRight size={20} color={colors.textMuted} />
              </View>
            </Pressable>
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
  filters: {
    marginBottom: spacing.lg,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchInput: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    paddingVertical: spacing['2xs'],
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing['2xs'],
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  // Route row — flat dark surface, map flush with the left and full-
  // height edges of the card. Only the text block carries inner padding.
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 100,
  },
  routeRowPressed: {
    opacity: 0.92,
  },
  routeRowBody: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  routeRowTrailing: {
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  // The map fills the row's full height (alignItems: stretch on parent),
  // and is a fixed width — no padding/border-radius locally because the
  // parent already clips with overflow: hidden.
  routeMiniMap: {
    width: 110,
    backgroundColor: colors.background,
  },
  routeMiniMapFeatured: {
    width: 110,
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
