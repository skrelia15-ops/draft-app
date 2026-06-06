/**
 * Thin wrapper around react-native-toast-message with DRAFT-brand
 * defaults. All call sites in the app should go through `toast.*` so we
 * can swap the underlying library later without grepping every screen.
 */
import Toast from 'react-native-toast-message';

type Options = {
  text2?: string;
  /** Duration in ms. Defaults to 2200. */
  durationMs?: number;
};

function show(
  type: 'success' | 'error' | 'info',
  text1: string,
  opts: Options = {},
) {
  Toast.show({
    type,
    text1,
    text2: opts.text2,
    position: 'top',
    visibilityTime: opts.durationMs ?? 2200,
    topOffset: 56,
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
