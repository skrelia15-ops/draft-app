import { colors, radius, spacing, typography } from '@/theme';
import { Pressable, StyleSheet, Text } from 'react-native';

type ChipProps = { label: string; active: boolean; onPress: () => void };

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
