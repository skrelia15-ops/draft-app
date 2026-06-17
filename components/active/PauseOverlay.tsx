import { colors, radius, spacing, typography } from '@/theme';
import { Play } from '@solar-icons/react-native/Linear';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function PauseOverlay({
  elapsedText,
  distanceText,
  avgSpeedText,
  onResume,
  onEnd,
}: {
  elapsedText: string;
  distanceText: string;
  avgSpeedText: string;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.overlayDim} />
      <View style={styles.overlayCard}>
        <Text style={styles.overlayBadge}>PAUSED</Text>
        <Text style={styles.overlayTitle}>RIDE ON HOLD</Text>
        <Text style={styles.overlayBody}>
          Stats are frozen. Time, distance and energy stop counting until you
          resume.
        </Text>
        <View style={styles.overlayStats}>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>TIME</Text>
            <Text style={styles.overlayStatValue}>{elapsedText}</Text>
          </View>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>DISTANCE</Text>
            <Text style={styles.overlayStatValue}>{distanceText}</Text>
          </View>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>AVG SPEED</Text>
            <Text style={styles.overlayStatValue}>{avgSpeedText}</Text>
          </View>
        </View>
        <Pressable style={styles.overlayPrimary} onPress={onResume}>
          <Play size={18} color={colors.textOnPrimary} />
          <Text style={styles.overlayPrimaryText}>RESUME</Text>
        </Pressable>
        <Pressable style={styles.overlayGhost} onPress={onEnd}>
          <Text style={styles.overlayGhostText}>END RIDE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pause overlay — sits on top of the live screen so the user keeps
  // their context. Stats remain visible (and frozen) underneath.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,17,17,0.65)',
  },
  overlayCard: {
    backgroundColor: colors.surfaceElevated,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius['2xl'],
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  overlayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.textOnPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['3xs'],
    borderRadius: radius.pill,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    overflow: 'hidden',
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing['2xs'],
  },
  overlayBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing.xs,
  },
  overlayStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.inactiveOnDark,
    marginBottom: spacing.xs,
  },
  overlayStat: {
    flex: 1,
  },
  overlayStatLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  overlayStatValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
  },
  overlayPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  overlayPrimaryText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  overlayGhost: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  overlayGhostText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
});
