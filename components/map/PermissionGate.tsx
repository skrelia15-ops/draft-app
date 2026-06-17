import { DangerCircle } from '@solar-icons/react-native/Linear';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/theme';

export function PermissionGate({
  message,
  onRetry,
  onPlanWithoutGps,
  sheetHeight,
}: {
  message: string;
  onRetry: () => void;
  onPlanWithoutGps: () => void;
  sheetHeight: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.permissionWrap, { paddingHorizontal: spacing.lg }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.permissionCard,
          // Float clearly above the bottom sheet with a gap, so the two
          // dark surfaces don't visually merge into one block.
          { marginBottom: insets.bottom + sheetHeight + spacing.lg },
        ]}
      >
        <View style={styles.permissionIcon}>
          <DangerCircle size={22} color={colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>LOCATION OFF</Text>
        <Text style={styles.permissionBody}>
          {message} You can still plan a route by typing an address or
          tapping the map — GPS is only needed once you start riding.
        </Text>
        <View style={styles.permissionRow}>
          <Pressable style={styles.permissionGhost} onPress={onRetry}>
            <Text style={styles.permissionGhostText}>RETRY</Text>
          </Pressable>
          <Pressable
            style={styles.permissionPrimary}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.permissionPrimaryText}>OPEN SETTINGS</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.permissionDismiss}
          onPress={onPlanWithoutGps}
          accessibilityRole="button"
        >
          <Text style={styles.permissionDismissText}>PLAN WITHOUT GPS</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    // Anchor the card to the bottom; its marginBottom lifts it above the
    // sheet so the gate floats just over it with a clear gap.
    justifyContent: 'flex-end',
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(17,17,17,0.5)' : colors.scrim,
  },
  permissionCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    alignItems: 'center',
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  permissionBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  permissionGhost: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  permissionGhostText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  permissionPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  permissionPrimaryText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  permissionDismiss: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  permissionDismissText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
});
