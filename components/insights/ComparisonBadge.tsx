import { computeInsights } from '@/lib/ride';
import { colors, radius, spacing, typography } from '@/theme';
import {
  ArrowDown,
  ArrowUp,
} from '@solar-icons/react-native/Linear';
import { StyleSheet, Text, View } from 'react-native';

export function ComparisonBadge({
  comparison,
}: {
  comparison: NonNullable<ReturnType<typeof computeInsights>['comparison']>;
}) {
  const Icon =
    comparison.direction === 'up'
      ? ArrowUp
      : comparison.direction === 'down'
        ? ArrowDown
        : null;
  const tone =
    comparison.direction === 'up'
      ? colors.primary
      : comparison.direction === 'down'
        ? colors.textMuted
        : colors.textMuted;
  return (
    <View style={[styles.comparisonRow, { borderColor: tone }]}>
      {Icon ? (
        <Icon size={14} color={tone} />
      ) : (
        <View style={[styles.comparisonDash, { backgroundColor: tone }]} />
      )}
      <Text style={[styles.comparisonText, { color: tone }]} numberOfLines={2}>
        {comparison.summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  comparisonDash: {
    width: 10,
    height: 2,
    borderRadius: radius.pill,
  },
  comparisonText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    flexShrink: 1,
  },
});
