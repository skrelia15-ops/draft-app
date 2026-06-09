import { IconButton, InputField, PrimaryButton } from '@/components/ui/draft';
import { useSignUpFlow } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { ArrowLeft } from '@solar-icons/react-native/Linear';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function SignUpEmailScreen() {
  const flow = useSignUpFlow();
  const [email, setEmail] = useState(flow.email);

  const trimmed = email.trim();
  const canSubmit = trimmed.length > 0;

  const handleNext = () => {
    if (!EMAIL_RE.test(trimmed)) {
      toast.error('Enter a valid email');
      return;
    }
    flow.setEmail(trimmed);
    router.push('/auth/sign-up/password' as Href);
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

        <Text style={styles.title}>{"WHAT'S YOUR EMAIL?"}</Text>
        <Text style={styles.subtitle}>
          {"We'll use this to set up your account."}
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
      </ScrollView>

      <PrimaryButton
        onPress={handleNext}
        disabled={!canSubmit}
        style={styles.primaryButton}
      >
        NEXT
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
