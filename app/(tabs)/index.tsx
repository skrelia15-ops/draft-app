import { useUserLocation } from '@/hooks/useUserLocation';
import {
    clusterNearbyRiders,
    getCompatibility,
    getCurrentConditions,
    getNearbyRiders,
    useRide,
    type DraftPotential,
    type RiderCluster,
} from '@/lib/ride';
import { buildGoalDays, GoalsCard } from '@/components/ui/draft';
import { useProfile } from '@/lib/profile';
import { colors, radius, spacing, typography } from '@/theme';
import { Bolt } from '@solar-icons/react-native/Bold';
import {
    ArrowRight,
    MapArrowRight,
    Wind,
} from '@solar-icons/react-native/Linear';
import { Href, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_SAFE_AREA = 110;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { history } = useRide();
  const { coords } = useUserLocation();
  const { profile } = useProfile();

  const conditions = useMemo(() => getCurrentConditions(), []);
  const riders = useMemo(() => getNearbyRiders(coords), [coords]);
  const clusters = useMemo(() => clusterNearbyRiders(riders), [riders]);
  const compatibility = useMemo(
    () => getCompatibility(history, riders),
    [history, riders],
  );

  const weeklyWatts = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return history
      .filter((r) => r.endedAt >= cutoff)
      .reduce((sum, r) => sum + r.energySavedWatts * (r.durationSec / 3600), 0);
  }, [history]);
  const weeklyWattsLabel =
    weeklyWatts >= 1000
      ? `${(weeklyWatts / 1000).toFixed(1)}k Wh`
      : `${Math.round(weeklyWatts)} Wh`;

  // Build the data the new Figma-port Goals card expects: a 7-element
  // Mon→Sun boolean array of "did the rider log a ride that day" plus
  // today's weekday index (also Mon-first).
  const { weekRideDays, ridesThisWeek, todayWeekdayIdx } = useMemo(
    () => buildWeekProgress(history.map((r) => r.endedAt)),
    [history],
  );

  const estimatedSave = Math.round(
    260 * (0.18 + (conditions.draftIndex / 100) * 0.16),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Bolt size={22} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.brand}>DRAFT</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.weeklyLabel}>THIS WEEK</Text>
          <Text style={styles.weeklyValue}>
            {history.length === 0 ? 'No rides yet' : weeklyWattsLabel}
          </Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.conditionPill}>
            <Text style={styles.conditionPillText}>
              {conditions.draftLabel} CONDITIONS
            </Text>
          </View>
          <View style={styles.draftIndex}>
            <Text style={styles.draftIndexValue}>{conditions.draftIndex}%</Text>
            <Text style={styles.draftIndexLabel}>DRAFT INDEX</Text>
          </View>
        </View>

        <Text style={styles.rideNow}>RIDE NOW</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>WIND</Text>
            <Text style={styles.heroStatValue}>
              {conditions.windKmh} km/h {conditions.windFrom}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>EST. SAVE</Text>
            <Text style={[styles.heroStatValue, styles.heroStatAccent]}>
              {estimatedSave}W
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>NEARBY</Text>
            <Text style={styles.heroStatValue}>{riders.length} riders</Text>
          </View>
        </View>

        <View style={styles.heroAdvice}>
          <Wind size={14} color={colors.textOnPrimary} />
          <Text style={styles.heroAdviceText}>{conditions.draftAdvice}</Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/ride/map' as Href)}
        >
          <Text style={styles.primaryButtonText}>PLAN A RIDE</Text>
          <ArrowRight size={20} color={colors.textOnDark} />
        </Pressable>
      </View>

      {/* GoalsCard lives directly below the hero — matches the Figma
          Home layout where the weekly-progress card is the SECOND card
          on the screen, not buried at the bottom. */}
      <View style={styles.goalsWrap}>
        <GoalsCard
          title="Your weekly goals"
          subtitle="Last 7 days"
          achievedLabel={`${ridesThisWeek}/${profile.weeklyRideGoal}`}
          days={buildGoalDays(weekRideDays, todayWeekdayIdx)}
          onPress={() => router.push('/goals' as Href)}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>RIDERS NEARBY</Text>
        <Pressable onPress={() => router.push('/ride/map' as Href)}>
          <Text style={styles.sectionLink}>VIEW MAP</Text>
        </Pressable>
      </View>

      {riders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No riders detected nearby. Start a ride to broadcast your presence.
          </Text>
        </View>
      ) : (
        // Top 3 clusters keeps the list short — anything more reads as
        // padding, and the user can tap "VIEW MAP" to see everybody.
        clusters.slice(0, 3).map((cluster) => (
          <RiderClusterRow
            key={cluster.id}
            cluster={cluster}
            onPress={() => router.push('/ride/map' as Href)}
          />
        ))
      )}

      <View style={[styles.sectionRow, styles.sectionRowSpaced]}>
        <Text style={styles.sectionTitle}>RIDING STYLE MATCH</Text>
      </View>

      {/* Static overview — does not navigate anywhere. The score is
          read-only context here; Profile is reached via the tab bar. */}
      <View style={styles.compatCard}>
        <View style={styles.compatHeader}>
          <View style={styles.compatScoreBlock}>
            <Text style={styles.compatScore}>{compatibility.score}</Text>
            <Text style={styles.compatScoreUnit}>/ 100</Text>
          </View>
          <View style={styles.compatBody}>
            <Text style={styles.compatTitle}>{compatibility.styleLabel}</Text>
            <Text style={styles.compatExplain} numberOfLines={2}>
              {compatibility.tier === 'BUILDING'
                ? 'Log rides to unlock your score and nearby matches.'
                : `${compatibility.nearbyMatchPercent}% match with nearby riders · ${compatibility.matchingRidersNearby} style match`}
            </Text>
          </View>
        </View>
        <View style={styles.compatBreakdown}>
          <CompatBar label="PACE" value={compatibility.paceMatch} />
          <CompatBar label="CADENCE" value={compatibility.cadenceMatch} />
          <CompatBar label="BEHAVIOUR" value={compatibility.behaviorMatch} />
        </View>
      </View>
    </ScrollView>
  );
}

function RiderClusterRow({
  cluster,
  onPress,
}: {
  cluster: RiderCluster;
  onPress: () => void;
}) {
  const tone = potentialColor(cluster.potential);
  return (
    <Pressable style={styles.clusterRow} onPress={onPress}>
      <View style={styles.clusterIcon}>
        <MapArrowRight size={22} color={colors.textOnDark} />
      </View>
      <View style={styles.riderBody}>
        <View style={styles.riderTopRow}>
          <Text style={styles.riderName}>{cluster.label}</Text>
          <Text style={styles.riderPace}>{cluster.avgSpeedKmh.toFixed(1)} km/h</Text>
        </View>
        <Text style={styles.riderHint}>
          {cluster.distanceMeters}m {cluster.direction} · {cluster.riderCount}{' '}
          {cluster.riderCount === 1 ? 'rider' : 'riders'} to join
        </Text>
      </View>
      <View style={styles.potentialBadge}>
        <View style={[styles.potentialDot, { backgroundColor: tone }]} />
        <Text style={[styles.potentialText, { color: tone }]}>
          {cluster.potential}
        </Text>
      </View>
    </Pressable>
  );
}

function CompatBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.compatBarRow}>
      <Text style={styles.compatBarLabel}>{label}</Text>
      <View style={styles.compatBarTrack}>
        <View style={[styles.compatBarFill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.compatBarValue}>{value}</Text>
    </View>
  );
}

/**
 * Status tone for a nearby rider's draft potential. Three discrete
 * hues — green (great match), amber (decent), muted (weak) — same
 * vocabulary used by the LIVE badge on Groups so users learn one
 * colour system instead of two.
 */
function potentialColor(p: DraftPotential): string {
  if (p === 'HIGH') return '#3FBF6E';
  if (p === 'MEDIUM') return '#F2A93B';
  return colors.textMuted;
}

/**
 * Roll up ride timestamps into the data the GoalsCard needs:
 *
 *   weekRideDays    Mon→Sun booleans for the current ISO week
 *   rideDaysThisWeek number of true values in weekRideDays
 *   todayWeekdayIdx  0–6 index of today (Mon = 0)
 */
function buildWeekProgress(timestamps: number[]): {
  /** Did at least one ride happen on each weekday this week? */
  weekRideDays: boolean[];
  /** Total rides this week (multiple per day count separately). */
  ridesThisWeek: number;
  todayWeekdayIdx: number;
} {
  const now = new Date();
  // Convert Sunday=0 → Sunday=6, Monday=0 (ISO-ish week).
  const todayWeekdayIdx = (now.getDay() + 6) % 7;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - todayWeekdayIdx);
  startOfWeek.setHours(0, 0, 0, 0);

  // Count total rides per weekday; the booleans are derived from these.
  // We split the two metrics because the bar visualisation cares about
  // "any ride happened" while the headline number is the goal-aware
  // total rides count.
  const ridesByDay = Array<number>(7).fill(0);
  for (const t of timestamps) {
    const d = new Date(t);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (dayStart.getTime() - startOfWeek.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays >= 0 && diffDays < 7) {
      ridesByDay[diffDays] += 1;
    }
  }
  const weekRideDays = ridesByDay.map((n) => n > 0);
  const ridesThisWeek = ridesByDay.reduce((a, b) => a + b, 0);
  return { weekRideDays, ridesThisWeek, todayWeekdayIdx };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: TAB_BAR_SAFE_AREA,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.lg,
    letterSpacing: typography.letterSpacing.wide,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  weeklyLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  weeklyValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginTop: spacing['3xs'],
  },
  // Hero card — the SINGLE yellow surface on Home (matches reference
  // design: one bold yellow card, everything else dark + muted).
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  conditionPill: {
    backgroundColor: 'rgba(17,17,17,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  conditionPillText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  draftIndex: {
    alignItems: 'flex-end',
  },
  draftIndexValue: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.xl,
  },
  draftIndexLabel: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    opacity: 0.7,
  },
  rideNow: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    marginBottom: spacing.lg,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['2xs'],
    opacity: 0.7,
  },
  heroStatValue: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.base,
  },
  heroStatAccent: {
    // No longer needed visually — kept for backward compat with the
    // existing JSX (EST. SAVE used to highlight in yellow on a dark
    // surface; on a yellow surface we just keep the same dark text).
    fontFamily: typography.fontFamily.extrabold,
  },
  heroAdvice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  heroAdviceText: {
    flex: 1,
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    opacity: 0.8,
  },
  // PLAN A RIDE — dark button on yellow surface (reverses the usual
  // pattern). Reads as the strongest CTA on the screen.
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  primaryButtonText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionRowSpaced: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  sectionMutedLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionLink: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    textDecorationLine: 'underline',
  },
  emptyCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  // Riders Nearby rows — flat list, hairline divider between rows.
  // No card chrome (the section header is enough hierarchy) so the
  // whole page doesn't read as nested bento.
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  clusterIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderBody: {
    flex: 1,
  },
  riderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing['3xs'],
  },
  riderName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.sm,
  },
  riderPace: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
  },
  riderHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  // Status pill — coloured dot + coloured label, no outline. Matches
  // the "LIVE" treatment on Groups for a consistent status vocabulary.
  potentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing['3xs'],
  },
  potentialDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  potentialText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  compatCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  compatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  compatScoreBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compatScore: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
  },
  compatScoreUnit: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    marginLeft: spacing['3xs'],
  },
  compatBody: {
    flex: 1,
  },
  compatTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  compatExplainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2xs'],
  },
  compatExplain: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    lineHeight: typography.size['2xs'] * typography.lineHeight.normal,
  },
  compatBreakdown: {
    gap: spacing.xs,
  },
  compatBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compatBarLabel: {
    width: 80,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  compatBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  compatBarFill: {
    height: '100%',
    backgroundColor: colors.textOnDark,
  },
  compatBarValue: {
    width: 24,
    textAlign: 'right',
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
  },
  goalsWrap: {
    marginBottom: spacing.xl,
  },
});
