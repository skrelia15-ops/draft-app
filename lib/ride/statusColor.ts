import { colors } from '@/theme';
import type { DraftPotential } from './proximity';

/** Status hue for a rider's draft potential — HIGH=green, MEDIUM=amber, else muted. */
export function draftPotentialColor(potential: DraftPotential): string {
  if (potential === 'HIGH') return colors.success;
  if (potential === 'MEDIUM') return colors.warning;
  return colors.textMuted;
}

/** Traffic-level hue — CLEAR=green, MODERATE=amber, HEAVY/other=red. */
export function trafficLevelColor(level: 'CLEAR' | 'MODERATE' | 'HEAVY'): string {
  if (level === 'CLEAR') return colors.success;
  if (level === 'MODERATE') return colors.warning;
  return colors.danger;
}
