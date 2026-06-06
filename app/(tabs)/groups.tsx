import { ElevatedCard } from '@/components/ui/draft';
import { colors, radius, spacing, typography } from '@/theme';
import { Href, router } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const TAB_BAR_SAFE_AREA = 110;

type TrainType = 'ROTATING' | 'STEADY' | 'TEMPO';

type LiveTrain = {
  id: string;
  name: string;
  riders: number;
  paceKmh: number;
  trainType: TrainType;
  /** Rough cardinal heading the train is rolling. */
  heading: string;
};

type Group = {
  id: string;
  name: string;
  riders: number;
  paceKmh: number;
  trainType: TrainType;
};

const LIVE_TRAINS: LiveTrain[] = [
  {
    id: 'morning-express',
    name: 'MORNING EXPRESS',
    riders: 12,
    paceKmh: 34,
    trainType: 'ROTATING',
    heading: 'NW · 4.2 km away',
  },
  {
    id: 'coastal-cruise',
    name: 'COASTAL CRUISE',
    riders: 8,
    paceKmh: 28,
    trainType: 'STEADY',
    heading: 'S · 1.8 km away',
  },
];

const SUGGESTED_GROUPS: Group[] = [
  {
    id: 'weekend-warriors',
    name: 'WEEKEND WARRIORS',
    riders: 45,
    paceKmh: 30,
    trainType: 'TEMPO',
  },
  {
    id: 'dawn-patrol',
    name: 'DAWN PATROL',
    riders: 22,
    paceKmh: 32,
    trainType: 'ROTATING',
  },
];

function trainTypeLabel(type: TrainType): string {
  if (type === 'ROTATING') return 'Rotating';
  if (type === 'STEADY') return 'Steady';
  return 'Tempo';
}

function GroupStatsRow({
  paceKmh,
  riders,
  trainType,
}: {
  paceKmh: number;
  riders: number;
  trainType: TrainType;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>PACE</Text>
        <Text style={styles.statValue}>{paceKmh} km/h</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>RIDERS</Text>
        <Text style={styles.statValue}>{riders}</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>TYPE</Text>
        <Text style={styles.statValue}>{trainTypeLabel(trainType)}</Text>
      </View>
    </View>
  );
}

/**
 * Groups screen — restructured to:
 *   1. LIVE TRAINS — highlighted as cards (the only "special" content)
 *   2. SUGGESTED GROUPS — divider-separated list rows, no card chrome
 *
 * The previous yellow "Match score" hero card lived here even though
 * the score is fundamentally a Profile concept. It's been removed —
 * compatibility now stays on Home / Profile, and Groups focuses on
 * groups.
 */
export default function GroupsScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>GROUPS</Text>
          <Text style={styles.headerSub}>Your riding community</Text>
        </View>
      </View>

      {/* LIVE TRAINS — cards because the LIVE state is the page's
          only true "hero" content. */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>LIVE TRAINS</Text>
        <View style={styles.liveCount}>
          <View style={styles.liveDot} />
          <Text style={styles.liveCountText}>{LIVE_TRAINS.length} now</Text>
        </View>
      </View>

      {LIVE_TRAINS.length === 0 ? (
        <ElevatedCard style={styles.emptyTrainCard}>
          <Text style={styles.emptyTrainTitle}>No trains rolling right now</Text>
          <Text style={styles.emptyTrainBody}>
            Start a ride to broadcast your route — others nearby can hop on.
          </Text>
        </ElevatedCard>
      ) : (
        LIVE_TRAINS.map((train) => (
          <ElevatedCard
            key={train.id}
            style={styles.trainCard}
            onPress={() => router.push('/ride/route-details' as Href)}
          >
            <View style={styles.trainCardHeader}>
              <View style={styles.trainBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.trainBadgeText}>LIVE</Text>
              </View>
              <Text style={styles.trainHeading}>{train.heading}</Text>
            </View>
            <Text style={styles.trainName}>{train.name}</Text>
            <GroupStatsRow
              paceKmh={train.paceKmh}
              riders={train.riders}
              trainType={train.trainType}
            />
          </ElevatedCard>
        ))
      )}

      {/* SUGGESTED GROUPS — divider list, no cards. The section header
          + hairline between rows is enough hierarchy. */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        SUGGESTED FOR YOU
      </Text>
      <Text style={styles.sectionHint}>Based on your pace and history</Text>

      <View style={styles.groupList}>
        {SUGGESTED_GROUPS.map((group) => (
          <Pressable
            key={group.id}
            accessibilityRole="button"
            onPress={() => router.push('/ride/route-details' as Href)}
            style={({ pressed }) => [
              styles.groupRow,
              pressed && styles.groupRowPressed,
            ]}
          >
            <View style={styles.groupIcon}>
              <Users size={20} color={colors.textOnDark} />
            </View>
            <View style={styles.groupBody}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupMeta}>
                {group.riders} riders · {group.paceKmh} km/h ·{' '}
                {trainTypeLabel(group.trainType)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: TAB_BAR_SAFE_AREA,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  sectionTitleSpaced: {
    marginTop: spacing['2xl'],
    marginBottom: spacing['2xs'],
  },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  // Status pill — dot + label, no outline (matches Home riders list).
  liveCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#3FBF6E',
  },
  liveCountText: {
    color: '#3FBF6E',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  trainCard: {
    marginBottom: spacing.sm,
  },
  trainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
  },
  trainBadgeText: {
    color: '#3FBF6E',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  trainHeading: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  trainName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginBottom: spacing.sm,
  },
  emptyTrainCard: {
    marginBottom: spacing.sm,
  },
  emptyTrainTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    marginBottom: spacing['2xs'],
  },
  emptyTrainBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing['3xs'],
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  // Suggested groups — flat divider list. Each row is just the icon +
  // text + chevron with a hairline rule between them.
  groupList: {
    // No background or border-radius; rows draw their own dividers.
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  groupRowPressed: {
    opacity: 0.85,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBody: {
    flex: 1,
  },
  groupName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  groupMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
});
