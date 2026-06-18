import { Pressable, StyleSheet, Text } from 'react-native';
import { Bolt } from '@solar-icons/react-native/Bold';
import { colors, radius, spacing, typography } from '@/theme';

/** Floating pill above the manual sheet that opens the smart route panel. */
export function SmartBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Suggest a route for today"
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <Bolt size={16} color={colors.primary} />
      <Text style={styles.label}>Suggest today's ride</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.primary,
    shadowColor: colors.black, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pressed: { opacity: 0.9 },
  label: {
    color: colors.textOnDark, fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wide,
  },
});
