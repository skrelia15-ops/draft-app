// app/groups/[id].tsx
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { colors, spacing, typography } from '@/theme';
import {
  getGroup,
  listGroupRides,
  joinGroup,
  leaveGroup,
  deleteGroup,
  trainTypeLabel,
  formatRideWhen,
  useGroups,
  type Group,
  type GroupRide,
} from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useGroups();
  const [group, setGroup] = useState<Group | null>(null);
  const [rides, setRides] = useState<GroupRide[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [g, r, auth] = await Promise.all([
      getGroup(id),
      listGroupRides(id),
      supabase.auth.getUser(),
    ]);
    setGroup(g);
    setRides(r);
    setUid(auth.data.user?.id ?? null);
  }, [id]);

  useEffect(() => {
    load().catch((e) => console.warn('[group detail] load failed', e));
  }, [load]);

  if (!group) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }

  const isOwner = uid != null && group.ownerId === uid;

  const onJoinLeave = async () => {
    setBusy(true);
    const ok = group.isMember ? await leaveGroup(group.id) : await joinGroup(group.id);
    setBusy(false);
    if (!ok) {
      toast.error('Something went wrong', { text2: 'Please try again.' });
      return;
    }
    await Promise.all([load(), refresh()]);
  };

  const onDelete = async () => {
    setBusy(true);
    const ok = await deleteGroup(group.id);
    setBusy(false);
    if (!ok) {
      toast.error('Could not delete group');
      return;
    }
    await refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{group.name}</Text>
      <Text style={styles.meta}>
        {group.memberCount} riders · {group.paceKmh} km/h · {trainTypeLabel(group.trainType)}
      </Text>
      {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

      {!isOwner ? (
        <PrimaryButton onPress={onJoinLeave} disabled={busy}>
          {busy ? '…' : group.isMember ? 'Leave group' : 'Join group'}
        </PrimaryButton>
      ) : null}

      {group.isMember ? (
        <SecondaryButton
          onPress={() => router.push(`/groups/${group.id}/schedule-ride` as Href)}
        >
          Schedule a ride
        </SecondaryButton>
      ) : null}

      <Text style={styles.sectionTitle}>UPCOMING RIDES</Text>
      {rides.length === 0 ? (
        <Text style={styles.meta}>No upcoming rides.</Text>
      ) : (
        rides.map((ride) => (
          <View key={ride.id} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{ride.title}</Text>
              <Text style={styles.meta}>{formatRideWhen(ride.scheduledAt)}</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        ))
      )}

      {isOwner ? (
        <View style={styles.ownerActions}>
          <SecondaryButton onPress={onDelete} disabled={busy}>
            {busy ? '…' : 'Delete group'}
          </SecondaryButton>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.md },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  description: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  ownerActions: { marginTop: spacing.xl },
});
