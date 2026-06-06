/**
 * Profile + bike data shapes.
 *
 * These mirror the eventual Supabase `users` and `bikes` tables so the
 * AsyncStorage layer can be swapped for a remote source without
 * touching screens.
 */

export type SkillLevel = 'Novice' | 'Pro' | 'Elite';
export type BikeType = 'Road' | 'Gravel' | 'MTB' | 'Hybrid';

export type Bike = {
  /** Display name e.g. "Specialized S-Works Tarmac". */
  name: string;
  type: BikeType;
  /** Weight in kg. Used in aero/effort estimates. */
  weightKg: number;
};

export type Profile = {
  /** Stable id — local until Supabase replaces it with auth.user.id. */
  id: string;
  name: string;
  skillLevel: SkillLevel;
  /** Average cruise pace in km/h. Used for ETA fallback. */
  avgPaceKmh: number;
  /** Optional avatar source (file:// URI or remote URL after Supabase). */
  avatarUri: string | null;
  bike: Bike | null;
  /**
   * How many rides per week the user wants to log. Drives the
   * "Weekly goals" card on Home and the goals detail screen.
   * 1–14 inclusive; defaults to 5.
   */
  weeklyRideGoal: number;
  updatedAt: number;
};

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 14;

export const DEFAULT_PROFILE: Profile = {
  id: 'local',
  name: 'Alex Rider',
  skillLevel: 'Pro',
  avgPaceKmh: 28,
  avatarUri: null,
  bike: {
    name: 'Specialized S-Works Tarmac',
    type: 'Road',
    weightKg: 7.2,
  },
  weeklyRideGoal: 5,
  updatedAt: 0,
};
