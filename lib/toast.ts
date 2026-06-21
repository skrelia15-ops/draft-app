/**
 * Thin wrapper around react-native-toast-message with DRAFT-brand
 * defaults. All call sites in the app should go through `toast.*` so we
 * can swap the underlying library later without grepping every screen.
 */
import Toast from 'react-native-toast-message';

type Options = {
  text2?: string;
  /** Duration in ms. Defaults to 4000 (5000 for errors). */
  durationMs?: number;
};

// Errors get a longer dwell — users need time to read the reason. The
// countdown progress bar in the toast template is driven by this same
// value (passed through `props.durationMs`), so they stay in sync.
const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 5000;

function show(
  type: 'success' | 'error' | 'info',
  text1: string,
  opts: Options = {},
) {
  const durationMs =
    opts.durationMs ?? (type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
  Toast.show({
    type,
    text1,
    text2: opts.text2,
    position: 'top',
    visibilityTime: durationMs,
    topOffset: 56,
    props: { durationMs },
  });
}

export const toast = {
  success(text1: string, opts?: Options) {
    show('success', text1, opts);
  },
  error(text1: string, opts?: Options) {
    show('error', text1, opts);
  },
  info(text1: string, opts?: Options) {
    show('info', text1, opts);
  },
  hide() {
    Toast.hide();
  },
};
