// app/(tabs)/groups.tsx
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { ChevronRight, Plus, Users } from 'lucide-react-native';
import { ElevatedCard } from '@/components/ui/draft';
import { colors, radius, spacing, typography } from '@/theme';
import { useGroups, trainTypeLabel, formatRideWhen, type Group, type GroupRide } from '@/lib/groups';

const TAB_BAR_SAFE_AREA = 110;

function GroupStatsRow({ group }: { group: Group }) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>PACE</Text>
        <Text style={styles.statValue}>{group.paceKmh} km/h</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>RIDERS</Text>
        <Text style={styles.statValue}>{group.memberCount}</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>TYPE</Text>
        <Text style={styles.statValue}>{trainTypeLabel(group.trainType)}</Text>
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const { myGroups, discoverGroups, upcomingRides, refresh } = useGroups();

  // Re-pull whenever the tab regains focus (after create/join/leave/schedule).
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const openGroup = (id: string) => router.push(`/groups/${id}` as Href);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create group"
          onPress={() => router.push('/groups/create' as Href)}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Plus size={20} color={colors.textOnDark} />
        </Pressable>
      </View>

      {/* MY GROUPS */}
      <Text style={styles.sectionTitle}>MY GROUPS</Text>
      {myGroups.length === 0 ? (
        <ElevatedCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{"You haven't joined any groups yet"}</Text>
          <Text style={styles.emptyBody}>
            Join one from Discover below, or create your own.
          </Text>
        </ElevatedCard>
      ) : (
        myGroups.map((group) => (
          <ElevatedCard key={group.id} style={styles.trainCard} onPress={() => openGroup(group.id)}>
            <Text style={styles.trainName}>{group.name}</Text>
            <GroupStatsRow group={group} />
          </ElevatedCard>
        ))
      )}

      {/* UPCOMING RIDES */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>UPCOMING RIDES</Text>
      {upcomingRides.length === 0 ? (
        <Text style={styles.sectionHint}>No rides scheduled in your groups yet.</Text>
      ) : (
        upcomingRides.map((ride: GroupRide) => (
          <Pressable
            key={ride.id}
            accessibilityRole="button"
            onPress={() => openGroup(ride.groupId)}
            style={({ pressed }) => [styles.groupRow, pressed && styles.groupRowPressed]}
          >
            <View style={styles.groupBody}>
              <Text style={styles.groupName}>{ride.title}</Text>
              <Text style={styles.groupMeta}>
                {ride.groupName} · {formatRideWhen(ride.scheduledAt)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}

      {/* DISCOVER */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>DISCOVER</Text>
      <Text style={styles.sectionHint}>Groups you can join</Text>
      <View style={styles.groupList}>
        {discoverGroups.length === 0 ? (
          <Text style={styles.sectionHint}>Nothing new to discover right now.</Text>
        ) : (
          discoverGroups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              onPress={() => openGroup(group.id)}
              style={({ pressed }) => [styles.groupRow, pressed && styles.groupRowPressed]}
            >
              <View style={styles.groupIcon}>
                <Users size={20} color={colors.textOnDark} />
              </View>
              <View style={styles.groupBody}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  {group.memberCount} riders · {group.paceKmh} km/h · {trainTypeLabel(group.trainType)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { opacity: 0.85 },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  sectionTitleSpaced: { marginTop: spacing['2xl'] },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  trainCard: { marginBottom: spacing.sm },
  trainName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginBottom: spacing.sm,
  },
  emptyCard: { marginBottom: spacing.sm },
  emptyTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    marginBottom: spacing['2xs'],
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBlock: { flex: 1 },
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
  groupList: {},
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  groupRowPressed: { opacity: 0.85 },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBody: { flex: 1 },
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
