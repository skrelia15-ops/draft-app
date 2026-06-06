import { IconButton, InputField, PrimaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { ArrowLeft } from '@solar-icons/react-native/Linear';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SignUpConfirmScreen() {
  const { signUpWithEmail } = useAuth();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const password = typeof params.password === 'string' ? params.password : '';

  const [confirm, setConfirm] = useState('');

  const canSubmit = confirm.length > 0;

  const handleSubmit = async () => {
    if (confirm !== password) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const { needsConfirmation } = await signUpWithEmail(email, password);
      if (needsConfirmation) {
        router.replace('/auth/sign-up/check-email' as Href);
      }
      // Otherwise a session was created and the root gate sends the user
      // straight into the profile wizard — no need to navigate here.
    } catch (e: any) {
      toast.error('Sign up failed', { text2: e?.message });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <IconButton
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={22} color={colors.textOnDark} />}
        />

        <Text style={styles.title}>CONFIRM PASSWORD</Text>
        <Text style={styles.subtitle}>Re-enter your password to confirm.</Text>

        <InputField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.input}
        />
      </ScrollView>

      <PrimaryButton
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={styles.primaryButton}
      >
        CREATE ACCOUNT
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.xl,
  },
  backButton: { width: 44, height: 44, marginBottom: spacing.lg },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing['2xl'],
  },
  input: { marginTop: spacing.sm, marginBottom: spacing.lg },
  primaryButton: { marginHorizontal: spacing.lg, marginBottom: spacing.xl },
});
