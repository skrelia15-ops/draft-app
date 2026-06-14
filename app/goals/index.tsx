import {
  buildGoalDays,
  GoalsCard,
  PrimaryButton,
} from '@/components/ui/draft';
import { useProfile, WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '@/lib/profile';
import {
  formatDistanceMeters,
  useRide,
} from '@/lib/ride';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import {
  AddCircle,
  ArrowLeft,
  MinusCircle,
  Target,
} from '@solar-icons/react-native/Linear';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Weekly Goals detail screen.
 *
 * Opens from the GoalsCard on Home. Shows:
 *   • A full-width copy of the weekly progress card
 *   • This week's stats (rides, distance, longest streak)
 *   • An editable weekly goal target (+/- stepper, clamped to 1–14)
 *
 * Persists via `useProfile().update`. Save button is only enabled when
 * the local stepper value differs from the saved goal.
 */
export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const { history } = useRide();

  const [goalDraft, setGoalDraft] = useState(profile.weeklyRideGoal);
  const [saving, setSaving] = useState(false);

  const week = useMemo(
    () => buildWeekStats(history.map((r) => ({ endedAt: r.endedAt, distanceMeters: r.distanceMeters }))),
    [history],
  );
  const streak = useMemo(
    () => computeStreak(history.map((r) => r.endedAt)),
    [history],
  );

  const canSave = goalDraft !== profile.weeklyRideGoal;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    await update({ weeklyRideGoal: goalDraft });
    toast.success('Goal saved', {
      text2: `Aiming for ${goalDraft} ride${goalDraft === 1 ? '' : 's'} a week`,
    });
    setSaving(false);
    router.back();
  };

  const inc = () =>
    setGoalDraft((v) => Math.min(WEEKLY_GOAL_MAX, v + 1));
  const dec = () =>
    setGoalDraft((v) => Math.max(WEEKLY_GOAL_MIN, v - 1));

  // Guard against silently losing an edited-but-unsaved goal when the
  // rider taps back. Only prompts when there's an actual pending change.
  const handleBack = () => {
    if (!canSave) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'Your new weekly goal hasn’t been saved yet.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerKicker}>WEEKLY GOALS</Text>
          <Text style={styles.headerTitle}>
            {week.ridesThisWeek}/{profile.weeklyRideGoal} this week
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <GoalsCard
          title="Your weekly goals"
          subtitle="Last 7 days"
          achievedLabel={`${week.ridesThisWeek}/${profile.weeklyRideGoal}`}
          days={buildGoalDays(week.dayBooleans, week.todayWeekdayIdx)}
          hideChevron
          hideTodayBadge
        />

        <Text style={styles.sectionTitle}>THIS WEEK</Text>
        <View style={styles.statsCard}>
          <Stat label="Rides" value={String(week.ridesThisWeek)} />
          <View style={styles.statDivider} />
          <Stat label="Distance" value={formatDistanceMeters(week.totalMeters)} />
          <View style={styles.statDivider} />
          <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
        </View>

        <Text style={styles.sectionTitle}>YOUR TARGET</Text>
        <View style={styles.targetCard}>
          <View style={styles.targetTopRow}>
            <View style={styles.targetIcon}>
              <Target size={22} color={colors.textOnDark} />
            </View>
            <View style={styles.targetBody}>
              <Text style={styles.targetTitle}>Rides per week</Text>
              <Text style={styles.targetHint}>
                Drives the weekly progress card on Home.
              </Text>
            </View>
          </View>

          <View style={styles.stepperRow}>
            <Pressable
              onPress={dec}
              disabled={goalDraft <= WEEKLY_GOAL_MIN}
              accessibilityRole="button"
              accessibilityLabel="Decrease weekly goal"
              hitSlop={spacing.sm}
              style={({ pressed }) => [
                styles.stepperBtn,
                goalDraft <= WEEKLY_GOAL_MIN && styles.stepperBtnDisabled,
                pressed && styles.stepperBtnPressed,
              ]}
            >
              <MinusCircle
                size={28}
                color={
                  goalDraft <= WEEKLY_GOAL_MIN
                    ? 'rgba(241,241,241,0.3)'
                    : colors.textOnDark
                }
              />
            </Pressable>
            <View style={styles.stepperValueBox}>
              <Text style={styles.stepperValue}>{goalDraft}</Text>
              <Text style={styles.stepperUnit}>
                / {WEEKLY_GOAL_MAX} max
              </Text>
            </View>
            <Pressable
              onPress={inc}
              disabled={goalDraft >= WEEKLY_GOAL_MAX}
              accessibilityRole="button"
              accessibilityLabel="Increase weekly goal"
              hitSlop={spacing.sm}
              style={({ pressed }) => [
                styles.stepperBtn,
                goalDraft >= WEEKLY_GOAL_MAX && styles.stepperBtnDisabled,
                pressed && styles.stepperBtnPressed,
              ]}
            >
              <AddCircle
                size={28}
                color={
                  goalDraft >= WEEKLY_GOAL_MAX
                    ? 'rgba(241,241,241,0.3)'
                    : colors.textOnDark
                }
              />
            </Pressable>
          </View>
        </View>

        <Text style={styles.footnote}>
          {goalDraft <= 2
            ? "Easy pace — perfect if you're starting out."
            : goalDraft <= 5
              ? 'Solid rhythm — most riders land here.'
              : goalDraft <= 8
                ? 'Ambitious — you ride more than most.'
                : 'Pro volume — make sure recovery keeps up.'}
        </Text>
      </ScrollView>

      <PrimaryButton
        onPress={handleSave}
        disabled={!canSave || saving}
        style={[
          styles.saveButton,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        SAVE GOAL
      </PrimaryButton>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Roll up ride records into the data this screen needs.
 *
 * `ridesThisWeek` counts TOTAL rides (two rides on the same day count
 * separately), so it can be measured against `weeklyRideGoal` which is
 * a target number of rides — not days. `dayBooleans` stays "did at
 * least one ride happen on this weekday" because that's all the 7-day
 * bar visualisation needs.
 */
function buildWeekStats(rides: { endedAt: number; distanceMeters: number }[]): {
  dayBooleans: boolean[];
  ridesThisWeek: number;
  totalMeters: number;
  todayWeekdayIdx: number;
} {
  const now = new Date();
  const todayWeekdayIdx = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - todayWeekdayIdx);
  startOfWeek.setHours(0, 0, 0, 0);

  const ridesByDay = Array<number>(7).fill(0);
  let totalMeters = 0;
  for (const r of rides) {
    const d = new Date(r.endedAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (d.getTime() - startOfWeek.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diff >= 0 && diff < 7) {
      ridesByDay[diff] += 1;
      totalMeters += r.distanceMeters;
    }
  }
  return {
    dayBooleans: ridesByDay.map((n) => n > 0),
    ridesThisWeek: ridesByDay.reduce((a, b) => a + b, 0),
    totalMeters,
    todayWeekdayIdx,
  };
}

function computeStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginTop: spacing.md,
  },
  // Stats row card — three columns with thin dividers between.
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: spacing['2xs'],
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.5,
    marginVertical: spacing.xs,
  },
  // Target editor card.
  targetCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    gap: spacing.md,
  },
  targetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBody: {
    flex: 1,
  },
  targetTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.base,
  },
  targetHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  stepperBtn: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.5,
  },
  stepperBtnPressed: {
    opacity: 0.7,
  },
  stepperValueBox: {
    flex: 1,
    alignItems: 'center',
  },
  stepperValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'],
  },
  stepperUnit: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginTop: -spacing.xs,
  },
  footnote: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  saveButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
});
