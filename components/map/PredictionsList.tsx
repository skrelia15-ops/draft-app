import { AltArrowRight, MapPoint } from '@solar-icons/react-native/Linear';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlacePrediction } from '@/lib/maps';
import { colors, radius, spacing, typography } from '@/theme';

export function PredictionsList({
  predictions,
  searching,
  onSelect,
}: {
  predictions: PlacePrediction[];
  searching: boolean;
  onSelect: (p: PlacePrediction) => void;
}) {
  return (
    <View style={styles.predictions}>
      {searching && (
        <View style={styles.predictionsLoading}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      )}
      {predictions.slice(0, 5).map((p) => (
        <Pressable
          key={p.placeId}
          onPress={() => onSelect(p)}
          style={({ pressed }) => [
            styles.predictionRow,
            pressed && styles.predictionRowPressed,
          ]}
        >
          <View style={styles.predictionIcon}>
            <MapPoint size={16} color={colors.primary} />
          </View>
          <View style={styles.predictionBody}>
            <Text style={styles.predictionPrimary} numberOfLines={1}>
              {p.primaryText}
            </Text>
            {!!p.secondaryText && (
              <Text style={styles.predictionSecondary} numberOfLines={1}>
                {p.secondaryText}
              </Text>
            )}
          </View>
          <AltArrowRight size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  predictions: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  predictionsLoading: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  predictionRowPressed: {
    backgroundColor: colors.background,
  },
  predictionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  predictionBody: {
    flex: 1,
  },
  predictionPrimary: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  predictionSecondary: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },
});
