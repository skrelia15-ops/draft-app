/**
 * Spacing tokens — 4-multiple scale inferred from Figma onboarding measurements.
 * Anchored to confirmed Figma values:
 *   3   — gap between page-indicator dots (Onboarding)
 *   20  — text-block left inset, gap between title and subtitle (Onboarding)
 *   60  — Next button size (Onboarding)
 */
export const spacing = {
  none: 0,
  '3xs': 2,
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export type SpacingToken = keyof typeof spacing;
