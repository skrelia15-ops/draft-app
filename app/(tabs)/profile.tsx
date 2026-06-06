import { useAuth } from '@/lib/auth';
import { avatarSignedUrl, isDirectUri, useProfile } from '@/lib/profile';
import {
    formatDistanceMeters,
    formatHourMin,
    getCompatibility,
    useRide,
    type RideRecord,
} from '@/lib/ride';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { Bolt } from '@solar-icons/react-native/Bold';
import { Bicycling, Logout3, Tuning } from '@solar-icons/react-native/Linear';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const TAB_BAR_SAFE_AREA = 110;

/** First + last initial from a "First Last" name, capitalised. */
function avatarInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Split a "First Last" name into the two stacked lines shown on the card. */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'RIDER', last: '' };
  if (parts.length === 1) return { first: parts[0].toUpperCase(), last: '' };
  return {
    first: parts[0].toUpperCase(),
    last: parts.slice(1).join(' ').toUpperCase(),
  };
}

export default function ProfileScreen() {
  const { history } = useRide();
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const compatibility = useMemo(() => getCompatibility(history), [history]);
  const { first, last } = splitName(profile.name);
  const bike = profile.bike;

  // avatarUri may be a direct file://-or-http URI or a Supabase Storage
  // path; resolve paths to a temporary signed URL for display.
  const [avatarDisplayUri, setAvatarDisplayUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const uri = profile.avatarUri;
    if (!uri) {
      setAvatarDisplayUri(null);
    } else if (isDirectUri(uri)) {
      setAvatarDisplayUri(uri);
    } else {
      avatarSignedUrl(uri).then((url) => {
        if (active) setAvatarDisplayUri(url);
      });
    }
    return () => {
      active = false;
    };
  }, [profile.avatarUri]);

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      "You'll need to sign in again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            // The root gate redirects to the slides once signed out.
            await signOut();
            toast.success('Logged out');
          },
        },
      ],
    );
  };

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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            {avatarDisplayUri ? (
              <Image
                source={{ uri: avatarDisplayUri }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>
                {avatarInitials(profile.name)}
              </Text>
            )}
          </View>
          <View style={styles.avatarBadge}>
            <Bolt size={14} color={colors.textOnPrimary} />
          </View>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{first}</Text>
          {last ? <Text style={styles.name}>{last}</Text> : null}
          <View style={styles.levelRow}>
            <Text style={styles.levelHighlight}>
              {compatibility.tier} DRAFTER
            </Text>
            <Text style={styles.levelDim}> · {compatibility.score}/100</Text>
          </View>
        </View>

        <Pressable
          style={styles.settingsButton}
          onPress={() =>
            router.push('/profile-setup?mode=edit' as Href)
          }
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
            // Any past ride opens the insights screen. The previous
            // implementation only navigated for `lastFinished`, leaving
            // older rows visually clickable but dead.
            onPress={() => router.push('/ride/insights' as Href)}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>BIKE SETUP</Text>

      {bike ? (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Bicycling size={20} color={colors.textOnDark} />
          </View>
          <View style={styles.activityBody}>
            <Text style={styles.activityName}>{bike.name.toUpperCase()}</Text>
            <Text style={styles.activityInfo}>
              {bike.type.toUpperCase()} · {bike.weightKg}KG
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.emptyCard}
          onPress={() =>
            router.push('/profile-setup?mode=edit' as Href)
          }
        >
          <Text style={styles.emptyText}>
            No bike added yet. Tap settings to set up your bike.
          </Text>
        </Pressable>
      )}

      </ScrollView>

      {/* Pinned above the floating tab bar — sits in a flex footer
          rather than inside the scroll, so it never floats mid-screen. */}
      <View style={styles.footer}>
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Logout3 size={18} color={colors.textMuted} />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </Pressable>
      </View>
    </View>
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
    <Pressable style={styles.activityRow} onPress={onPress}>
      <Bicycling size={18} color={colors.textMuted} />
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    // Smaller than the floating tab-bar height — the pinned footer
    // below already reserves the rest.
    paddingBottom: spacing.lg,
  },
  // Pinned footer sits between the scroll content and the floating
  // tab bar. Vertical padding mirrors the safe-area handling on other
  // screens.
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.xl,
    letterSpacing: typography.letterSpacing.wide,
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
  // Bike setup keeps the card chrome — it's a single highlighted block.
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  // Recent activity rows are flat list items with a hairline divider —
  // the section header alone provides enough hierarchy.
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
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
  // Log-out lives intentionally at the bottom, looks like a tertiary
  // action (muted text + icon), and is gated behind a confirm Alert.
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  logoutText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
});
