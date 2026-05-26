/**
 * Color tokens — inferred strictly from Figma onboarding screens.
 * Source values from Figma:
 *   #F6EB4C  Brand yellow (Onboarding-1 background, Onboarding-2 button, Onboarding-3 active dot)
 *   #111111  Dark surface / text (Onboarding-1/2 text, Onboarding-3 background, Onboarding-1 button)
 *   #1F1F1F  Card / elevated surface — single shared color for every card-like
 *            container (route cards, hero, bottom sheets, tab bar, search input,
 *            field, pill chip). Sits one step above `background`.
 *   #FFFFFF  Light surface / text (Onboarding-2 background, Onboarding-3 text, Onboarding-3 button)
 *   #C9C16A  Inactive control on yellow surface (Onboarding-1 inactive dots)
 *   #D9D9D9  Inactive control on light surface (Onboarding-2 inactive dots)
 *   #3D3D3D  Inactive control on dark surface (Onboarding-3 inactive dots) —
 *            also used for borders / dividers on top of card surfaces.
 */
export const colors = {
  // Brand
  primary: '#F6EB4C',

  // Surfaces
  background: '#111111',
  surfaceLight: '#FFFFFF',
  surfaceElevated: '#1F1F1F',

  // Text
  textOnDark: '#FFFFFF',
  textOnLight: '#111111',
  textOnPrimary: '#111111',
  textMuted: '#D9D9D9',
  textSubtle: '#3D3D3D',

  // Inactive states / borders on dark cards
  inactiveOnDark: '#3D3D3D',
  inactiveOnLight: '#D9D9D9',
  inactiveOnPrimary: '#C9C16A',

  // Raw
  white: '#FFFFFF',
  black: '#111111',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

// #region agent log
fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5cfb28' },
  body: JSON.stringify({
    sessionId: '5cfb28',
    location: 'theme/colors.ts:module',
    message: 'colors module loaded',
    data: {
      colorCount: Object.keys(colors).length,
      hasBlack: 'black' in colors,
      hasSurfaceElevated: 'surfaceElevated' in colors,
      primary: colors.primary,
    },
    timestamp: Date.now(),
    hypothesisId: 'A',
    runId: 'post-fix',
  }),
}).catch(() => {});
// #endregion
