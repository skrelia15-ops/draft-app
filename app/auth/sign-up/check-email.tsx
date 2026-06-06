import { PrimaryButton } from '@/components/ui/draft';
import { colors, spacing, typography } from '@/theme';
import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function CheckEmailScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>CHECK YOUR INBOX</Text>
        <Text style={styles.subtitle}>
          We sent you a confirmation link. Tap it to verify your email, then
          come back and log in.
        </Text>
      </View>

      <PrimaryButton
        onPress={() => router.replace('/auth/sign-in' as Href)}
        style={styles.primaryButton}
      >
        BACK TO LOGIN
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  primaryButton: {
    marginBottom: spacing.xl,
  },
});
