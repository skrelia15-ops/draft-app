import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { cardBase } from './_shared';

type StatCardProps = {
  label: string;
  value: string | number;
  context?: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StatCard({ label, value, context, accent, style }: StatCardProps) {
  return (
    <View style={[styles.statCard, style]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      {context ? <Text style={styles.statContext}>{context}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    ...cardBase,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  statValueAccent: {
    color: colors.primary,
  },
  statContext: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    marginTop: spacing['2xs'],
  },
});
