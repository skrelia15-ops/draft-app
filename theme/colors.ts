/**
 * Color tokens — taken directly from the Figma "Draft app" library.
 *
 *   #F9F186  surface/accent       Brand yellow (tab-bar ride button, hero card, CTAs)
 *   #111111  surface/static-black App background and tab-bar pill
 *   #1F1F1F  Card / elevated surface — every card-like container sits one step
 *            above the background on this fill.
 *   #FFFFFF  surface/primary      Light surface (used sparingly)
 *   #F1F1F1  Primary text-on-dark — slightly off-white per Figma library
 *
 * Inactive variants are derived from opacity in component styles (e.g.
 * `rgba(241,241,241,0.3)` for muted text on dark) rather than separate tokens.
 */
export const colors = {
  // Brand
  primary: '#F9F186',

  // Surfaces
  background: '#111111',
  surfaceLight: '#FFFFFF',
  surfaceElevated: '#1F1F1F',

  // Text
  textOnDark: '#F1F1F1',
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
