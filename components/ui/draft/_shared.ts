import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export const ui = {
  softShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const cardBase = {
  backgroundColor: colors.surfaceElevated,
  borderRadius: radius.xl,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.hairline,
} as const;

export const pressedStyle = StyleSheet.create({ pressed: { opacity: 0.88 } }).pressed;
