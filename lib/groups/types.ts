// lib/groups/types.ts
export type TrainType = 'ROTATING' | 'STEADY' | 'TEMPO';
export type MemberRole = 'owner' | 'member';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  paceKmh: number;
  trainType: TrainType;
  ownerId: string;
  /** Derived from groups_with_counts.member_count. */
  memberCount: number;
  /** Whether the current user belongs to this group (set by storage). */
  isMember: boolean;
  createdAt: number;
};

export type GroupRide = {
  id: string;
  groupId: string;
  /** Joined from groups for the cross-group UPCOMING list. */
  groupName: string;
  title: string;
  scheduledAt: number;
  routeId: string | null;
  createdBy: string;
  createdAt: number;
};

export function trainTypeLabel(type: TrainType): string {
  if (type === 'ROTATING') return 'Rotating';
  if (type === 'STEADY') return 'Steady';
  return 'Tempo';
}

export function formatRideWhen(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
