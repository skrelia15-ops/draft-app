/**
 * Border-radius tokens — anchored to confirmed Figma values.
 *   3.5  — active page-indicator dot (Onboarding)
 *   30   — Next button (60×60 round, Onboarding)
 */
export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 30,
  pill: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
