import { colors, radius } from '@/theme';
import { StyleSheet, View } from 'react-native';

export function SplitBar({ drafting, solo }: { drafting: number; solo: number }) {
  const draftingClamped = Math.max(0, Math.min(100, drafting));
  const soloClamped = Math.max(0, 100 - draftingClamped);
  return (
    <View style={styles.splitBar}>
      <View
        style={[
          styles.splitBarFill,
          { backgroundColor: colors.primary, flex: draftingClamped },
        ]}
      />
      <View
        style={[
          styles.splitBarFill,
          { backgroundColor: colors.textSubtle, flex: soloClamped },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splitBar: {
    height: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  splitBarFill: {
    height: '100%',
  },
});
