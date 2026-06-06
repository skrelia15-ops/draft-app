import { PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

        <View style={styles.socialRow}>
          {Platform.OS === 'ios' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in with Apple"
              onPress={() => social(signInWithApple)}
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.socialButtonPressed,
              ]}
            >
              <Ionicons name="logo-apple" size={26} color={colors.textOnDark} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            onPress={() => social(signInWithGoogle)}
            style={({ pressed }) => [
              styles.socialButton,
              pressed && styles.socialButtonPressed,
            ]}
          >
            <Ionicons name="logo-google" size={24} color={colors.textOnDark} />
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
  socialRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonPressed: {
    opacity: 0.7,
  },
});
