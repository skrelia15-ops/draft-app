import { colors, radius, spacing, typography } from '@/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.tag}>
      {icon}
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tagLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'capitalize',
  },
});
