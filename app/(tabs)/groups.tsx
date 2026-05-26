import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { UsersGroupTwoRounded } from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import { getCompatibility, useRide } from '@/lib/ride';
import {
  HighlightCard,
  ListItemCard,
  PrimaryButton,
  PrimaryCard,
} from '@/components/ui/draft';

const TAB_BAR_SAFE_AREA = 110;

type TrainType = 'ROTATING' | 'STEADY' | 'TEMPO';

type Group = {
  id: string;
  name: string;
  riders: number;
  paceKmh: number;
  tier: 'ELITE' | 'PRO' | 'OPEN';
  live: boolean;
  trainType: TrainType;
};

const ACTIVE_TRAINS: Group[] = [
  {
    id: 'morning-express',
    name: 'MORNING EXPRESS',
    riders: 12,
    paceKmh: 34,
    tier: 'ELITE',
    live: true,
    trainType: 'ROTATING',
  },
  {
    id: 'coastal-cruise',
    name: 'COASTAL CRUISE',
    riders: 8,
    paceKmh: 28,
    tier: 'PRO',
    live: true,
    trainType: 'STEADY',
  },
];

const SUGGESTED_GROUPS: Group[] = [
  {
    id: 'weekend-warriors',
    name: 'WEEKEND WARRIORS',
    riders: 45,
    paceKmh: 30,
    tier: 'PRO',
    live: false,
    trainType: 'TEMPO',
  },
];

function trainTypeLabel(type: TrainType): string {
  if (type === 'ROTATING') return 'Rotating';
  if (type === 'STEADY') return 'Steady';
  return 'Tempo';
}

function TrainStats({ group }: { group: Group }) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>Pace</Text>
        <Text style={styles.statValue}>{group.paceKmh} km/h</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>Riders</Text>
        <Text style={styles.statValue}>{group.riders}</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>Type</Text>
        <Text style={styles.statValue}>{trainTypeLabel(group.trainType)}</Text>
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const { history } = useRide();
  const compatibility = useMemo(() => getCompatibility(history), [history]);
  const matchScore = history.length > 0 ? compatibility.score : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>GROUPS</Text>
          <Text style={styles.headerSub}>Who to ride with</Text>
        </View>
        <View style={styles.headerBadge}>
          <UsersGroupTwoRounded size={22} color={colors.textMuted} />
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>ACTIVE DRAFT TRAINS</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {ACTIVE_TRAINS.map((train) => (
        <PrimaryCard key={train.id} style={styles.activeCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.trainName}>{train.name}</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{train.tier}</Text>
            </View>
          </View>
          <TrainStats group={train} />
          <PrimaryButton
            style={styles.joinButton}
            onPress={() => router.push('/ride/route-details' as Href)}
          >
            Join train
          </PrimaryButton>
        </PrimaryCard>
      ))}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        SUGGESTED FOR YOU
      </Text>

      <HighlightCard style={styles.matchCard}>
        <Text style={styles.matchTitle}>Match score</Text>
        <Text style={styles.matchScoreLarge}>
          {matchScore !== null ? `${matchScore}%` : '—'}
        </Text>
        <Text style={styles.matchContext}>
          Based on pace, cadence, and drafting history
        </Text>
        {history.length > 0 && (
          <Text style={styles.matchDetail}>
            {compatibility.styleLabel} · {compatibility.explanation.split('.')[0]}
          </Text>
        )}
      </HighlightCard>

      {SUGGESTED_GROUPS.map((group) => (
        <ListItemCard
          key={group.id}
          style={styles.suggestedCard}
          onPress={() => router.push('/ride/route-details' as Href)}
          leading={
            <View style={styles.suggestedIcon}>
              <UsersGroupTwoRounded size={22} color={colors.textMuted} />
            </View>
          }
        >
          <Text style={styles.suggestedName}>{group.name}</Text>
          <TrainStats group={group} />
        </ListItemCard>
      ))}
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
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#3FBF6E',
  },
  liveText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  activeCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trainName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    flex: 1,
  },
  tierBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tierBadgeText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  joinButton: {
    minHeight: 48,
  },
  matchCard: {
    marginBottom: spacing.md,
  },
  matchTitle: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    opacity: 0.85,
    marginBottom: spacing['2xs'],
  },
  matchScoreLarge: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'],
    marginBottom: spacing.xs,
  },
  matchContext: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    opacity: 0.9,
    marginBottom: spacing['2xs'],
  },
  matchDetail: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    opacity: 0.85,
    lineHeight: typography.size['2xs'] * typography.lineHeight.normal,
  },
  suggestedCard: {
    marginBottom: spacing.sm,
  },
  suggestedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.sm,
    marginBottom: spacing.xs,
  },
});
