/**
 * Typography tokens — Darker Grotesque family used across the Figma onboarding.
 * Anchored to confirmed Figma values:
 *   50px / lineHeight 1.1 / SemiBold   — slide title
 *   26px / lineHeight 1.3 / Medium     — slide subtitle
 *   18px / lineHeight 1.3 / Medium     — skip text
 *
 * When using custom fonts in React Native, weight comes from the
 * fontFamily — not from the `fontWeight` style prop.
 */
export const typography = {
  fontFamily: {
    medium: 'DarkerGrotesque_500Medium',
    semibold: 'DarkerGrotesque_600SemiBold',
    bold: 'DarkerGrotesque_700Bold',
    extrabold: 'DarkerGrotesque_800ExtraBold',
  },
  size: {
    '2xs': 10,
    xs: 12,
    sm: 14,
    base: 16,
    md: 18,
    lg: 22,
    xl: 26,
    '2xl': 32,
    '3xl': 48,
    display: 50,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.3,
    relaxed: 1.5,
  },
  letterSpacing: {
    normal: 0,
    wide: 1,
    wider: 1.5,
  },
} as const;

export type TypographyFamily = keyof typeof typography.fontFamily;
export type TypographySize = keyof typeof typography.size;
