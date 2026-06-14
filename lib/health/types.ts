/** Post-ride health metrics pulled from / derived for Apple Health.
 *  All nullable: absent when the user has no Watch, denied access, or is
 *  on a platform without HealthKit. */
export type RideHealth = {
  avgHeartRate: number | null;   // bpm
  maxHeartRate: number | null;   // bpm
  activeCalories: number | null; // kcal
};
