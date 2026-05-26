export type TrafficLevel = 'CLEAR' | 'MODERATE' | 'HEAVY';
/** Lower weight = less traffic (better for scenic rides). */
export function trafficWeight(traffic: TrafficLevel): number {
  if (traffic === 'CLEAR') return 0;
  if (traffic === 'MODERATE') return 1;
  return 2;
}
