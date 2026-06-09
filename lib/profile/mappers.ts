import type { Bike, Profile, SkillLevel } from './types';

export type ProfileRow = {
  id: string;
  name: string;
  skill_level: SkillLevel;
  avg_pace_kmh: number;
  avatar_url: string | null;
  bike: Bike | null;
  weekly_ride_goal: number;
  updated_at: string;
};

/** Parse an ISO timestamp, falling back to 0 for null/garbage values so
 *  downstream date math never propagates NaN. */
function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    skillLevel: row.skill_level,
    avgPaceKmh: row.avg_pace_kmh,
    avatarUri: row.avatar_url,
    bike: row.bike,
    weeklyRideGoal: row.weekly_ride_goal,
    updatedAt: parseTimestamp(row.updated_at),
  };
}

/** Columns the client is allowed to write (id is the PK, updated_at is server-set here). */
export type ProfileUpdate = Omit<ProfileRow, 'id' | 'updated_at'>;

export function profileToRow(p: Profile): ProfileUpdate {
  return {
    name: p.name,
    skill_level: p.skillLevel,
    avg_pace_kmh: p.avgPaceKmh,
    avatar_url: p.avatarUri,
    bike: p.bike,
    weekly_ride_goal: p.weeklyRideGoal,
  };
}
