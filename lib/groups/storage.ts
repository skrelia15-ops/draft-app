// lib/groups/storage.ts
import { supabase } from '@/lib/supabase';
import {
  rowToGroup,
  rowToGroupMember,
  rowToGroupRide,
  type GroupRow,
  type GroupMemberRow,
  type GroupRideRow,
} from './mappers';
import type { Group, GroupMember, GroupRide, TrainType } from './types';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function myGroupIds(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  const { data } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', uid);
  return new Set((data ?? []).map((r) => r.group_id));
}

export async function listMyGroups(): Promise<Group[]> {
  const ids = await myGroupIds();
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .in('id', [...ids])
    .order('member_count', { ascending: false });
  if (error || !data) {
    console.warn('[groups/storage] listMyGroups failed', error);
    return [];
  }
  return (data as unknown as GroupRow[]).map((r) => rowToGroup(r, true));
}

export async function listDiscoverGroups(): Promise<Group[]> {
  const ids = await myGroupIds();
  let query = supabase
    .from('groups_with_counts')
    .select('*')
    .order('member_count', { ascending: false });
  if (ids.size > 0) {
    query = query.not('id', 'in', `(${[...ids].join(',')})`);
  }
  const { data, error } = await query;
  if (error || !data) {
    console.warn('[groups/storage] listDiscoverGroups failed', error);
    return [];
  }
  return (data as unknown as GroupRow[]).map((r) => rowToGroup(r, false));
}

export async function getGroup(id: string): Promise<Group | null> {
  const ids = await myGroupIds();
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return rowToGroup(data as unknown as GroupRow, ids.has(id));
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, role, joined_at, profiles(name, avatar_url)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error || !data) {
    console.warn('[groups/storage] listMembers failed', error);
    return [];
  }
  return (data as unknown as GroupMemberRow[]).map(rowToGroupMember);
}

export async function createGroup(input: {
  name: string;
  description: string | null;
  paceKmh: number;
  trainType: TrainType;
}): Promise<Group | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: input.name,
      description: input.description,
      pace_kmh: input.paceKmh,
      train_type: input.trainType,
      owner_id: uid,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.warn('[groups/storage] createGroup failed', error);
    return null;
  }
  // The on_group_created trigger adds the owner as a member.
  return getGroup(data.id);
}

export async function updateGroup(
  id: string,
  patch: { name?: string; description?: string | null; paceKmh?: number; trainType?: TrainType },
): Promise<boolean> {
  const payload: {
    name?: string;
    description?: string | null;
    pace_kmh?: number;
    train_type?: TrainType;
  } = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.paceKmh !== undefined) payload.pace_kmh = patch.paceKmh;
  if (patch.trainType !== undefined) payload.train_type = patch.trainType;
  const { error } = await supabase.from('groups').update(payload).eq('id', id);
  if (error) {
    console.warn('[groups/storage] updateGroup failed', error);
    return false;
  }
  return true;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) {
    console.warn('[groups/storage] deleteGroup failed', error);
    return false;
  }
  return true;
}

export async function joinGroup(groupId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: uid, role: 'member' });
  if (error) {
    console.warn('[groups/storage] joinGroup failed', error);
    return false;
  }
  return true;
}

export async function leaveGroup(groupId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', uid);
  if (error) {
    console.warn('[groups/storage] leaveGroup failed', error);
    return false;
  }
  return true;
}

const RIDE_SELECT =
  'id, group_id, title, scheduled_at, route_id, created_by, created_at, groups(name)';

export async function listUpcomingRides(): Promise<GroupRide[]> {
  const ids = await myGroupIds();
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from('group_rides')
    .select(RIDE_SELECT)
    .in('group_id', [...ids])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });
  if (error || !data) {
    console.warn('[groups/storage] listUpcomingRides failed', error);
    return [];
  }
  return (data as unknown as GroupRideRow[]).map(rowToGroupRide);
}

export async function listGroupRides(groupId: string): Promise<GroupRide[]> {
  const { data, error } = await supabase
    .from('group_rides')
    .select(RIDE_SELECT)
    .eq('group_id', groupId)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });
  if (error || !data) {
    console.warn('[groups/storage] listGroupRides failed', error);
    return [];
  }
  return (data as unknown as GroupRideRow[]).map(rowToGroupRide);
}

export async function scheduleRide(input: {
  groupId: string;
  title: string;
  scheduledAt: number;
  routeId: string | null;
}): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('group_rides').insert({
    group_id: input.groupId,
    title: input.title,
    scheduled_at: new Date(input.scheduledAt).toISOString(),
    route_id: input.routeId,
    created_by: uid,
  });
  if (error) {
    console.warn('[groups/storage] scheduleRide failed', error);
    return false;
  }
  return true;
}
