import { colors as _colorsCheck } from './colors';

// #region agent log
fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5cfb28' },
  body: JSON.stringify({
    sessionId: '5cfb28',
    location: 'theme/index.ts:module',
    message: 'theme index loaded',
    data: {
      colorsType: typeof _colorsCheck,
      colorsIsUndefined: _colorsCheck === undefined,
      colorKeys: _colorsCheck ? Object.keys(_colorsCheck) : null,
    },
    timestamp: Date.now(),
    hypothesisId: 'A',
    runId: 'post-fix',
  }),
}).catch(() => {});
// #endregion

export { colors } from './colors';
export type { ColorToken } from './colors';

export { spacing } from './spacing';
export type { SpacingToken } from './spacing';

export { typography } from './typography';
export type { TypographyFamily, TypographySize } from './typography';

export { radius } from './radius';
export type { RadiusToken } from './radius';
