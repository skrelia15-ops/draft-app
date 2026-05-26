import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bolt } from '@solar-icons/react-native/Bold';
import {
  ArrowRight,
  Compass,
  Wind,
  InfoCircle,
  MapArrowRight,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import {
  clusterNearbyRiders,
  getCompatibility,
  getCurrentConditions,
  getNearbyRiders,
  useRide,
  type RiderCluster,
  type NearbyRider,
  type DraftPotential,
} from '@/lib/ride';
import { useUserLocation } from '@/hooks/useUserLocation';

const TAB_BAR_SAFE_AREA = 110;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { history } = useRide();
  const { coords } = useUserLocation();

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

  const streakDays = useMemo(() => computeStreak(history.map((r) => r.endedAt)), [history]);

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
          <Wind size={14} color={colors.primary} />
          <Text style={styles.heroAdviceText}>{conditions.draftAdvice}</Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/ride/map' as Href)}
        >
          <Text style={styles.primaryButtonText}>PLAN A RIDE</Text>
          <ArrowRight size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>RIDERS NEARBY</Text>
        <Pressable onPress={() => router.push('/explore' as Href)}>
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
        <>
          {clusters.slice(0, 3).map((cluster) => (
            <RiderClusterRow
              key={cluster.id}
              cluster={cluster}
              onPress={() => router.push('/ride/map' as Href)}
            />
          ))}
          {riders.slice(0, 2).map((rider) => (
            <NearbyRiderRow
              key={rider.id}
              rider={rider}
              onPress={() => router.push('/ride/map' as Href)}
            />
          ))}
        </>
      )}

      <View style={[styles.sectionRow, styles.sectionRowSpaced]}>
        <Text style={styles.sectionTitle}>RIDING STYLE MATCH</Text>
        <Text style={styles.sectionMutedLabel}>{compatibility.tier}</Text>
      </View>

      <Pressable
        style={styles.compatCard}
        onPress={() => router.push('/profile' as Href)}
      >
        <View style={styles.compatHeader}>
          <View style={styles.compatScoreBlock}>
            <Text style={styles.compatScore}>{compatibility.score}</Text>
            <Text style={styles.compatScoreUnit}>/ 100</Text>
          </View>
          <View style={styles.compatBody}>
            <Text style={styles.compatTitle}>{compatibility.styleLabel}</Text>
            <View style={styles.compatExplainRow}>
              <InfoCircle size={14} color={colors.textMuted} />
              <Text style={styles.compatExplain} numberOfLines={2}>
                {compatibility.nearbyMatchPercent}% match with nearby riders ·{' '}
                {compatibility.matchingRidersNearby} style match
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.compatBreakdown}>
          <CompatBar label="PACE" value={compatibility.paceMatch} />
          <CompatBar label="CADENCE" value={compatibility.cadenceMatch} />
          <CompatBar label="BEHAVIOUR" value={compatibility.behaviorMatch} />
        </View>
      </Pressable>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>STREAK</Text>
          <Text style={styles.statValue}>
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>RIDES</Text>
          <Text style={styles.statValue}>{history.length}</Text>
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
      <View style={[styles.clusterIcon, { borderColor: tone }]}>
        <MapArrowRight size={22} color={tone} />
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
      <View style={[styles.potentialBadge, { borderColor: tone }]}>
        <Text style={[styles.potentialText, { color: tone }]}>
          {cluster.potential}
        </Text>
      </View>
    </Pressable>
  );
}

function NearbyRiderRow({
  rider,
  onPress,
}: {
  rider: NearbyRider;
  onPress: () => void;
}) {
  const tone = potentialColor(rider.potential);
  return (
    <Pressable style={styles.riderRow} onPress={onPress}>
      <View style={styles.riderIcon}>
        <Compass size={22} color={tone} />
      </View>
      <View style={styles.riderBody}>
        <View style={styles.riderTopRow}>
          <Text style={styles.riderName}>{rider.name}</Text>
          <Text style={styles.riderPace}>{rider.paceKmh.toFixed(1)} km/h</Text>
        </View>
        <Text style={styles.riderHint}>{rider.hint}</Text>
      </View>
      <View style={[styles.potentialBadge, { borderColor: tone }]}>
        <Text style={[styles.potentialText, { color: tone }]}>
          {rider.potential}
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

function potentialColor(p: DraftPotential): string {
  if (p === 'HIGH') return colors.primary;
  if (p === 'MEDIUM') return colors.textOnDark;
  return colors.textMuted;
}

function computeStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  // Count consecutive days back from today that have at least one ride.
  const days = new Set<string>();
  for (const t of timestamps) {
    const d = new Date(t);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // No ride today is fine; check yesterday before breaking.
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
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
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginTop: spacing['3xs'],
  },
  heroCard: {
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.primary,
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
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.xl,
  },
  draftIndexLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  rideNow: {
    color: colors.textOnDark,
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
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['2xs'],
  },
  heroStatValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.base,
  },
  heroStatAccent: {
    color: colors.primary,
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
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
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
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionLink: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
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
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  clusterIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
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
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
  },
  riderHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  potentialBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.pill,
    borderWidth: 1,
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
    color: colors.primary,
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
    backgroundColor: colors.primary,
  },
  compatBarValue: {
    width: 24,
    textAlign: 'right',
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
});
