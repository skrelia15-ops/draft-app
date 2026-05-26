import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { Bolt } from '@solar-icons/react-native/Bold';
import { Pulse2, Tuning } from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import {
  formatDistanceMeters,
  formatHourMin,
  getCompatibility,
  useRide,
  type RideRecord,
} from '@/lib/ride';

const TAB_BAR_SAFE_AREA = 110;

export default function ProfileScreen() {
  const { history, lastFinished } = useRide();
  const compatibility = useMemo(() => getCompatibility(history), [history]);

  const totals = useMemo(() => {
    const rides = history.length;
    const distance = history.reduce((s, r) => s + r.distanceMeters, 0);
    const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyRides = history.filter((r) => r.endedAt >= weekCutoff).length;
    const avgEfficiency = rides > 0
      ? Math.round(
          history.reduce((s, r) => s + r.energySavedPercent, 0) / rides,
        )
      : 0;
    return { rides, distance, weeklyRides, avgEfficiency };
  }, [history]);

  const stats = [
    {
      label: 'WEEKLY RIDES',
      value: `${totals.weeklyRides}`,
    },
    {
      label: 'TOTAL DIST.',
      value: formatDistanceMeters(totals.distance),
    },
    {
      label: 'AVG SAVED',
      value: `${totals.avgEfficiency}%`,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            <Image
              source={require('../../assets/images/onboarding/bike-bg.jpg')}
              style={styles.avatarImage}
            />
          </View>
          <View style={styles.avatarBadge}>
            <Bolt size={14} color={colors.textOnPrimary} />
          </View>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>ALEX</Text>
          <Text style={styles.name}>RIDER</Text>
          <View style={styles.levelRow}>
            <Text style={styles.levelHighlight}>
              {compatibility.tier} DRAFTER
            </Text>
            <Text style={styles.levelDim}> · {compatibility.score}/100</Text>
          </View>
        </View>

        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/onboarding/profile-setup' as Href)}
        >
          <Tuning size={20} color={colors.textOnDark} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statBox}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>

      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No rides yet. Start your first ride from the home tab to see your
            history here.
          </Text>
        </View>
      ) : (
        history.slice(0, 6).map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            onPress={() => {
              if (lastFinished?.id === activity.id) {
                router.push('/ride/insights' as Href);
              }
            }}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>BIKE SETUP</Text>

      <View style={styles.activityCard}>
        <View style={styles.activityIcon}>
          <Pulse2 size={20} color={colors.primary} />
        </View>
        <View style={styles.activityBody}>
          <Text style={styles.activityName}>SPECIALIZED S-WORKS TARMAC</Text>
          <Text style={styles.activityInfo}>AERO OPTIMIZED · 7.2KG</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ActivityRow({
  activity,
  onPress,
}: {
  activity: RideRecord;
  onPress: () => void;
}) {
  const distance = formatDistanceMeters(activity.distanceMeters);
  const duration = formatHourMin(activity.durationSec);
  const date = formatRelative(activity.endedAt);
  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <View style={styles.activityIcon}>
        <Pulse2 size={20} color={colors.textMuted} />
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityName}>
          {activity.routeName ?? 'FREE RIDE'}
        </Text>
        <Text style={styles.activityInfo}>
          {distance} · {duration} · {date}
        </Text>
      </View>
      <View style={styles.activitySavedBlock}>
        <Text style={styles.activitySaved}>
          {activity.energySavedPercent}%
        </Text>
        <Text style={styles.activitySavedLabel}>SAVED</Text>
      </View>
    </Pressable>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'JUST NOW';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}M AGO`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}H AGO`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}D AGO`;
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
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    lineHeight: typography.size['2xl'],
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2xs'],
  },
  levelHighlight: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  levelDim: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
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
    marginTop: spacing['2xs'],
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  sectionTitleSpaced: {
    marginTop: spacing.xl,
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
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
  },
  activityName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  activityInfo: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  activitySavedBlock: {
    alignItems: 'flex-end',
  },
  activitySaved: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  activitySavedLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
});
