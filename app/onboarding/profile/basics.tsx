import { InputField, PrimaryButton } from '@/components/ui/draft';
import { useWizard } from '@/lib/onboarding/WizardProvider';
import { type SkillLevel } from '@/lib/profile';
import { colors, radius, spacing, typography } from '@/theme';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SKILL_LEVELS: readonly SkillLevel[] = ['Novice', 'Pro', 'Elite'];

/**
 * Wizard step 1 — name + skill level on a single screen. No back button:
 * this is the first wizard step and the user is committed post-signup.
 */
export default function BasicsScreen() {
  const { draft, setDraft } = useWizard();

  const nameValid = draft.name.trim().length > 0;

  const handleNext = () => {
    router.push('/onboarding/profile/bike' as Href);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>RIDER DNA</Text>
        <Text style={styles.subtitle}>
          Let&apos;s set up your profile so we can match the perfect draft.
        </Text>

        <InputField
          label="Your name"
          value={draft.name}
          onChangeText={(name) => setDraft({ name })}
          placeholder="Alex Rider"
          autoFocus
          containerStyle={styles.input}
        />

        <Text style={styles.label}>SKILL LEVEL</Text>
        <View style={styles.chipsRow}>
          {SKILL_LEVELS.map((level) => {
            const active = draft.skillLevel === level;
            return (
              <Pressable
                key={level}
                onPress={() => setDraft({ skillLevel: level })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <PrimaryButton
        onPress={handleNext}
        disabled={!nameValid}
        style={styles.primaryButton}
      >
        NEXT
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
  label: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '22%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.sm,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  primaryButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
});
