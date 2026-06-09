// lib/groups/mappers.ts
import type { Group, GroupRide, TrainType } from './types';

function parseTs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  pace_kmh: number;
  train_type: TrainType;
  owner_id: string;
  member_count: number | null;
  created_at: string;
};

export function rowToGroup(row: GroupRow, isMember: boolean): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    paceKmh: row.pace_kmh,
    trainType: row.train_type,
    ownerId: row.owner_id,
    memberCount: row.member_count ?? 0,
    isMember,
    createdAt: parseTs(row.created_at),
  };
}

export type GroupRideRow = {
  id: string;
  group_id: string;
  title: string;
  scheduled_at: string;
  route_id: string | null;
  created_by: string;
  created_at: string;
  groups: { name: string } | null;
};

export function rowToGroupRide(row: GroupRideRow): GroupRide {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.groups?.name ?? '',
    title: row.title,
    scheduledAt: parseTs(row.scheduled_at),
    routeId: row.route_id,
    createdBy: row.created_by,
    createdAt: parseTs(row.created_at),
  };
}
