import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import { IconButton, InputField, PrimaryButton } from '@/components/ui/draft';

const skillLevels = ['Novice', 'Pro', 'Elite'];

export default function ProfileSetupScreen() {
  const [name, setName] = useState('Alex Rider');
  const [skill, setSkill] = useState('Pro');
  const [pace, setPace] = useState('28');

  const handleCreate = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <IconButton
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={22} color={colors.textOnDark} />}
        />

        <Text style={styles.title}>RIDER DNA</Text>
        <Text style={styles.subtitle}>
          Define your profile to match the perfect draft.
        </Text>

        <InputField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Alex Rider"
          containerStyle={styles.input}
        />

        <Text style={styles.label}>SKILL LEVEL</Text>
        <View style={styles.chipsRow}>
          {skillLevels.map((level) => {
            const active = skill === level;
            return (
              <Pressable
                key={level}
                onPress={() => setSkill(level)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <InputField
          label="Average pace (km/h)"
          value={pace}
          onChangeText={setPace}
          keyboardType="numeric"
          containerStyle={styles.input}
        />
      </ScrollView>

      <PrimaryButton onPress={handleCreate} style={styles.primaryButton}>
        CREATE PROFILE
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
    marginBottom: spacing['3xl'],
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
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.md,
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
