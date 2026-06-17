import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { pressedStyle } from './_shared';

type IconButtonProps = {
  onPress: () => void;
  icon: React.ReactNode;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  disabled?: boolean;
};

export function IconButton({
  onPress,
  icon,
  accessibilityLabel,
  style,
  selected,
  disabled,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.iconButtonSelected,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && pressedStyle,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
});
