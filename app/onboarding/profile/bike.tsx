import {
  IconButton,
  InputField,
  PrimaryButton,
  SecondaryButton,
} from '@/components/ui/draft';
import { useWizard } from '@/lib/onboarding/WizardProvider';
import { type BikeType } from '@/lib/profile';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { ArrowLeft, Bicycling } from '@solar-icons/react-native/Linear';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const BIKE_TYPES: readonly BikeType[] = ['Road', 'Gravel', 'MTB', 'Hybrid'];

// Matches profile-setup's validation bounds for consistency.
const BIKE_WEIGHT_MIN = 3;
const BIKE_WEIGHT_MAX = 20;

/**
 * Wizard step 2 — optional bike. SKIP commits without a bike; FINISH
 * commits with the entered bike. Both end on the tabs.
 */
export default function BikeScreen() {
  const { setDraft, commit } = useWizard();

  const [bikeName, setBikeName] = useState('');
  const [bikeType, setBikeType] = useState<BikeType>('Road');
  const [bikeWeight, setBikeWeight] = useState('7.2');
  const [submitting, setSubmitting] = useState(false);

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Ensure no bike is persisted on the skip path.
      setDraft({ bike: null });
      await commit();
      router.replace('/(tabs)' as Href);
    } catch {
      toast.error('Could not save your profile', {
        text2: 'Please try again.',
      });
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    if (submitting) return;

    const weightNumber = Number(bikeWeight);
    const weightValid =
      Number.isFinite(weightNumber) &&
      weightNumber >= BIKE_WEIGHT_MIN &&
      weightNumber <= BIKE_WEIGHT_MAX;

    if (!weightValid) {
      toast.error('Bike weight looks off', {
        text2: `Enter a value between ${BIKE_WEIGHT_MIN} and ${BIKE_WEIGHT_MAX} kg.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      setDraft({
        bike: {
          name: bikeName.trim() || 'My bike',
          type: bikeType,
          weightKg: Math.round(weightNumber * 10) / 10,
        },
      });
      await commit();
      router.replace('/(tabs)' as Href);
    } catch {
      toast.error('Could not save your profile', {
        text2: 'Please try again.',
      });
      setSubmitting(false);
    }
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

        <Text style={styles.title}>BIKE SETUP</Text>
        <Text style={styles.subtitle}>
          Add your bike to estimate aero savings. You can skip this and add
          it later.
        </Text>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Bicycling size={18} color={colors.textOnDark} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>YOUR BIKE</Text>
            <Text style={styles.sectionSubtitle}>Used to estimate aero savings</Text>
          </View>
        </View>

        <InputField
          label="Bike name"
          value={bikeName}
          onChangeText={setBikeName}
          placeholder="My bike"
          containerStyle={styles.input}
        />

        <Text style={styles.label}>BIKE TYPE</Text>
        <View style={styles.chipsRow}>
          {BIKE_TYPES.map((type) => {
            const active = bikeType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setBikeType(type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <InputField
          label="Bike weight (kg)"
          value={bikeWeight}
          onChangeText={setBikeWeight}
          keyboardType="decimal-pad"
          containerStyle={styles.input}
        />
      </ScrollView>

      <View style={styles.footer}>
        <SecondaryButton
          onPress={handleSkip}
          disabled={submitting}
          style={styles.footerButton}
        >
          SKIP
        </SecondaryButton>
        <PrimaryButton
          onPress={handleFinish}
          disabled={submitting}
          style={styles.footerButton}
        >
          FINISH
        </PrimaryButton>
      </View>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
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
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  footerButton: {
    flex: 1,
  },
});
