import { PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * True when the error is the user dismissing the native Apple/Google sheet
 * rather than a real failure — these must NOT surface as an error toast.
 * Apple throws `ERR_REQUEST_CANCELED`; Google throws `SIGN_IN_CANCELLED`
 * (and `-5` / `12501` on some platform/version combos).
 */
function isCancellation(e: any): boolean {
  const code = String(e?.code ?? '');
  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'SIGN_IN_CANCELLED' ||
    code === '-5' ||
    code === '12501' ||
    /cancel/i.test(String(e?.message ?? ''))
  );
}

/**
 * Apple Sign In stays hidden until there's an Apple Developer Program
 * membership with the "Sign in with Apple" capability. Set
 * EXPO_PUBLIC_APPLE_AUTH_ENABLED="true" (and rebuild — it also toggles the
 * native entitlement in app.config.ts) to bring the button back. Note: App
 * Store review requires Sign in with Apple once Google sign-in is offered, so
 * this must be enabled before a public launch.
 */
const APPLE_AUTH_ENABLED =
  Platform.OS === 'ios' &&
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true';

export default function ChooseAuthScreen() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const social = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      if (!isCancellation(e)) {
        if (__DEV__) {
          console.warn(
            '[auth] social sign-in failed →',
            'status:', e?.status,
            'code:', e?.code,
            'message:', e?.message,
          );
        }
        toast.error('Sign in failed', { text2: e?.message });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>WELCOME TO</Text>
        <Text style={styles.title}>DRAFT</Text>
        <Text style={styles.subtitle}>
          Ride smarter. Find your slipstream.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push('/auth/sign-up/email' as Href)}>
          CREATE ACCOUNT
        </PrimaryButton>

        <SecondaryButton onPress={() => router.push('/auth/sign-in' as Href)}>
          I HAVE AN ACCOUNT
        </SecondaryButton>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialColumn}>
          {APPLE_AUTH_ENABLED && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => social(signInWithApple)}
              style={({ pressed }) => [
                styles.socialButton,
                (pressed || busy) && styles.socialButtonPressed,
              ]}
            >
              <Ionicons name="logo-apple" size={22} color={colors.textOnDark} />
              <Text style={styles.socialButtonLabel}>CONTINUE WITH APPLE</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => social(signInWithGoogle)}
            style={({ pressed }) => [
              styles.socialButton,
              (pressed || busy) && styles.socialButtonPressed,
            ]}
          >
            <Ionicons name="logo-google" size={20} color={colors.textOnDark} />
            <Text style={styles.socialButtonLabel}>CONTINUE WITH GOOGLE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing['4xl'],
  },
  kicker: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.display,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  actions: {
    gap: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.inactiveOnDark,
  },
  dividerText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  socialColumn: {
    gap: spacing.sm,
  },
  socialButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  socialButtonLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  socialButtonPressed: {
    opacity: 0.7,
  },
});
