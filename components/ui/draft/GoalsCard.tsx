import { colors, radius, spacing, typography } from '@/theme';
import { Bolt } from '@solar-icons/react-native/Bold';
import { AltArrowRight } from '@solar-icons/react-native/Linear';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Goals card — ported 1:1 from Figma node 8021:359.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ Your daily goals                    ▶   │
 *   │ Last 7 days                              │
 *   │                                          │
 *   │ 4/7    ━━ ━━ ━━ ▶▶ ▤ ░░ ░░               │
 *   │ Achieved  M  T  W  T  F  S  S            │
 *   └─────────────────────────────────────────┘
 *
 * - Dark elevated surface (#1F1F1F), 30px corner radius
 * - "Title + period" stack on the left, chevron on the right
 * - Big number on the left, then 7 day-bars filling remaining width
 * - Today (highlighted) gets a yellow Bolt overlay on the bar
 * - Past completed days are 80% white; future days are 5% white (dim)
 */

export type Goal = {
  /** Single-letter day label (M, T, W, T, F, S, S). */
  label: string;
  /** `done` — completed, `today` — current day, `pending` — future/missed. */
  state: 'done' | 'today' | 'pending';
};

type GoalsCardProps = {
  /** Big number on the left, e.g. "4/7". */
  achievedLabel: string;
  /** Caption below the number. Defaults to "Achieved". */
  achievedCaption?: string;
  /** Header line, defaults to "Your daily goals". */
  title?: string;
  /** Sub-header line, defaults to "Last 7 days". */
  subtitle?: string;
  /** Seven days, ordered Monday → Sunday. */
  days: Goal[];
  /** Tap handler on the whole card (chevron). */
  onPress?: () => void;
  /** Hide the chevron in the header — used when the card isn't tappable. */
  hideChevron?: boolean;
  /**
   * Hide the yellow "today" badge on the current day's progress bar.
   * Useful on the dedicated goals page where the highlight is noise
   * (the whole screen IS about today's week).
   */
  hideTodayBadge?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GoalsCard({
  achievedLabel,
  achievedCaption = 'Achieved',
  title = 'Your daily goals',
  subtitle = 'Last 7 days',
  days,
  onPress,
  hideChevron,
  hideTodayBadge,
  style,
}: GoalsCardProps) {
  const body = (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {hideChevron ? null : (
          <AltArrowRight size={16} color={colors.textOnDark} />
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.achievedBlock}>
          <Text style={styles.achievedNumber}>{achievedLabel}</Text>
          <Text style={styles.achievedCaption}>{achievedCaption}</Text>
        </View>
        <View style={styles.progress}>
          {days.map((day, i) => (
            <DayColumn
              key={`${day.label}-${i}`}
              day={day}
              hideTodayBadge={hideTodayBadge}
            />
          ))}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${achievedLabel} ${achievedCaption.toLowerCase()}`}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

function DayColumn({
  day,
  hideTodayBadge,
}: {
  day: Goal;
  hideTodayBadge?: boolean;
}) {
  return (
    <View style={styles.dayColumn}>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.bar,
            day.state === 'done' && styles.barDone,
            day.state === 'pending' && styles.barPending,
            day.state === 'today' && styles.barDone,
          ]}
        />
        {day.state === 'today' && !hideTodayBadge && (
          <View style={styles.todayBadge}>
            <Bolt size={14} color={colors.textOnPrimary} />
          </View>
        )}
      </View>
      <Text style={styles.dayLabel}>{day.label}</Text>
    </View>
  );
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Convenience helper — turn a 7-element boolean array (Monday-first) plus
 * the index of "today" into the shape `GoalsCard` expects. Days before
 * `todayIndex` are graded `done`/`pending` based on the boolean; days
 * after are forced `pending`.
 */
export function buildGoalDays(
  achievedByDay: boolean[],
  todayIndex: number,
): Goal[] {
  return DAY_LETTERS.map((letter, i) => {
    if (i === todayIndex) return { label: letter, state: 'today' };
    if (i < todayIndex && achievedByDay[i]) {
      return { label: letter, state: 'done' };
    }
    return { label: letter, state: 'pending' };
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 30,
    padding: spacing.md,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: spacing.xs,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
  },
  subtitle: {
    color: 'rgba(241,241,241,0.7)',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.tight,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  achievedBlock: {
    gap: spacing.xs,
  },
  achievedNumber: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xl'],
    lineHeight: typography.size['2xl'] * typography.lineHeight.tight,
  },
  achievedCaption: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.tight,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  bar: {
    height: 8,
    borderRadius: radius.pill,
    width: '100%',
  },
  barDone: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  barPending: {
    backgroundColor: 'rgba(241,241,241,0.05)',
  },
  todayBadge: {
    position: 'absolute',
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    color: '#F2F2F2',
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.95,
  },
});
