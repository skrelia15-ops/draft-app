import { IconButton, InputField, PrimaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { ArrowLeft } from '@solar-icons/react-native/Linear';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SignInScreen() {
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e: any) {
      toast.error('Could not sign in', { text2: e?.message });
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

        <Text style={styles.title}>WELCOME BACK</Text>
        <Text style={styles.subtitle}>
          Log in to get back in the slipstream.
        </Text>

        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.input}
        />

        <InputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          containerStyle={styles.input}
        />
      </ScrollView>

      <PrimaryButton
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={styles.primaryButton}
      >
        LOG IN
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    marginBottom: spacing.lg,
  },
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
  input: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
});
