import { IconButton, InputField, PrimaryButton } from '@/components/ui/draft';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';
import { ArrowLeft } from '@solar-icons/react-native/Linear';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const MIN_LENGTH = 6;

export default function SignUpPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [password, setPassword] = useState('');

  const canSubmit = password.length > 0;

  const handleNext = () => {
    if (password.length < MIN_LENGTH) {
      toast.error('Password too short', {
        text2: `Use at least ${MIN_LENGTH} characters.`,
      });
      return;
    }
    router.push({
      pathname: '/auth/sign-up/confirm',
      params: { email, password },
    } as Href);
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

        <Text style={styles.title}>CREATE A PASSWORD</Text>
        <Text style={styles.subtitle}>
          At least {MIN_LENGTH} characters to keep your account secure.
        </Text>

        <InputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
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
