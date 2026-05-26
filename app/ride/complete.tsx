import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle } from '@solar-icons/react-native/Bold';
import { ArrowRight } from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import {
  formatDistanceMeters,
  formatHourMin,
  useRide,
} from '@/lib/ride';

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const { lastFinished, acknowledgeFinished } = useRide();

  // If somehow we arrive without a finished ride, fall back to safe zeros
  // so we never crash.
  const distance = lastFinished?.distanceMeters ?? 0;
  const duration = lastFinished?.durationSec ?? 0;
  const energyPercent = lastFinished?.energySavedPercent ?? 0;
  const stats = [
    { label: 'DISTANCE', value: formatDistanceMeters(distance) },
    { label: 'TIME', value: formatHourMin(duration) },
    { label: 'ENERGY SAVED', value: `${energyPercent}%` },
  ];

  const goHome = () => {
    acknowledgeFinished();
    router.dismissAll();
    router.replace('/(tabs)' as Href);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing['2xl'],
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.iconBox}>
          <CheckCircle size={48} color={colors.primary} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>DRAFT</Text>
          <Text style={styles.title}>COMPLETE</Text>
        </View>

        <Text style={styles.subtitle}>
          {lastFinished
            ? lastFinished.draftingFraction > 0.5
              ? 'Strong drafting throughout. Recovery earned.'
              : 'Good ride — there\u2019s more energy to save next time.'
            : 'You rode smarter, safer, and faster.'}
        </Text>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/ride/insights' as Href)}
      >
        <Text style={styles.primaryButtonText}>VIEW INSIGHTS</Text>
        <ArrowRight size={20} color={colors.textOnPrimary} />
      </Pressable>

      <Pressable style={styles.dashboardButton} onPress={goHome}>
        <Text style={styles.dashboardText}>GO TO HOMEPAGE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBox: {
    width: 110,
    height: 110,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'],
    lineHeight: typography.size['3xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  stat: {
    alignItems: 'center',
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
    fontSize: typography.size.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  dashboardButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dashboardText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
});
