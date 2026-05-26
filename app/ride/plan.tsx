import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { Bolt, MapPoint } from '@solar-icons/react-native/Bold';
import {
  ArrowLeft,
  Magnifier,
  Pulse2,
  AltArrowRight,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';

const filters = ['WITH DRAFT', 'SAFEST', 'PERFORMANCE', 'SCENIC'];

const routes = [
  {
    id: '1',
    badge: 'BEST FOR DRAFTING NOW',
    name: 'COASTAL SLIPSTREAM',
    distance: '24.5 KM',
    difficulty: 'MODERATE',
    pace: '32 KM/H',
    indicator: 4,
    indicatorTotal: 5,
    riders: '8 Riders Nearby',
    efficiency: '92',
    selected: true,
  },
  {
    id: '2',
    badge: 'HIGH PERFORMANCE RIDE',
    name: 'URBAN DRAFT LOOP',
    distance: '12.2 KM',
    difficulty: 'EASY',
    pace: '28 KM/H',
    indicator: 3,
    indicatorTotal: 5,
    riders: '15 Riders Nearby',
    efficiency: '88',
    selected: false,
  },
];

export default function PlanRideScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.header}>PLAN RIDE</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <MapPoint size={20} color={colors.primary} />
          <Text style={styles.fieldText}>Current Location</Text>
        </View>

        <Pressable
          style={styles.field}
          onPress={() => router.push('/ride/search' as Href)}
        >
          <Magnifier size={20} color={colors.textMuted} />
          <Text style={styles.fieldPlaceholder}>Search destination...</Text>
        </Pressable>

        <Pressable
          style={styles.field}
          onPress={() => router.push('/ride/route-details' as Href)}
        >
          <Pulse2 size={20} color={colors.primary} />
          <Text style={[styles.fieldText, styles.fieldTextLetters]}>OR CREATE A LOOP</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((label, i) => (
            <View
              key={label}
              style={[styles.filter, i === 0 && styles.filterActive]}
            >
              <Text
                style={[styles.filterText, i === 0 && styles.filterActiveText]}
              >
                {label}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>SUGGESTED ROUTES</Text>
          <Text style={styles.sectionCount}>{routes.length} Found</Text>
        </View>

        {routes.map((route) => (
          <View
            key={route.id}
            style={[styles.routeCard, route.selected && styles.routeCardSelected]}
          >
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{route.badge}</Text>
            </View>

            <Text style={styles.routeName}>{route.name}</Text>

            <View style={styles.routeMeta}>
              <Text style={styles.routeMetaText}>{route.distance}</Text>
              <View style={styles.routeMetaDot} />
              <Text style={styles.routeMetaText}>{route.difficulty}</Text>
              <View style={styles.routeMetaDot} />
              <Text style={styles.routeMetaText}>{route.pace}</Text>
            </View>

            <View style={styles.routeIndicatorRow}>
              <View style={styles.routeIndicator}>
                {Array.from({ length: route.indicatorTotal }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.routeIndicatorBar,
                      i < route.indicator && styles.routeIndicatorBarActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.routeRiders}>{route.riders}</Text>
            </View>

            <View style={styles.routeFooter}>
              <View style={styles.routeEfficiency}>
                <View style={styles.routeEfficiencyDot} />
                <Text style={styles.routeEfficiencyText}>
                  DRAFT EFFICIENCY: {route.efficiency}%
                </Text>
              </View>
              <Pressable
                style={styles.viewDetailsRow}
                onPress={() => router.push('/ride/route-details' as Href)}
              >
                <Text style={styles.viewDetails}>VIEW{'\n'}DETAILS</Text>
                <AltArrowRight size={16} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/ride/route-details' as Href)}
      >
        <Text style={styles.primaryButtonText}>REVIEW ROUTES</Text>
      </Pressable>
    </View>
  );
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
    paddingTop: spacing['4xl'],
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
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
  },
  fieldTextLetters: {
    fontFamily: typography.fontFamily.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
  fieldPlaceholder: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
  },
  filtersScroll: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  filtersContent: {
    gap: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  filterActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  filterActiveText: {
    color: colors.textOnPrimary,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  routeCardSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  routeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: radius.md,
  },
  routeBadgeText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  routeName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingRight: spacing['4xl'],
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
  routeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routeIndicator: {
    flexDirection: 'row',
    gap: spacing['2xs'],
  },
  routeIndicatorBar: {
    width: 14,
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.inactiveOnDark,
  },
  routeIndicatorBarActive: {
    backgroundColor: colors.primary,
  },
  routeRiders: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeEfficiency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  routeEfficiencyDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  routeEfficiencyText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontStyle: 'italic',
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
  },
  viewDetails: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontStyle: 'italic',
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    textAlign: 'right',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
});
