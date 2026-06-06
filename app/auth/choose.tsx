import { PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, type Href } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ChooseAuthScreen() {
  const { signInWithApple, signInWithGoogle } = useAuth();

  const social = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      toast.error('Sign in failed', { text2: e?.message });
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
        <PrimaryButton
          onPress={() => router.push('/auth/sign-up/email' as Href)}
        >
          CREATE ACCOUNT
        </PrimaryButton>

        <SecondaryButton
          onPress={() => router.push('/auth/sign-in' as Href)}
        >
          I HAVE AN ACCOUNT
        </SecondaryButton>

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={() => social(signInWithApple)}
          />
        )}

        <SecondaryButton onPress={() => social(signInWithGoogle)}>
          CONTINUE WITH GOOGLE
        </SecondaryButton>
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
  appleButton: {
    height: 52,
    width: '100%',
  },
});
