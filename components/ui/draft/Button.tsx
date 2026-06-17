import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { pressedStyle } from './_shared';

type ButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  iconRight?: React.ReactNode;
  iconLeft?: React.ReactNode;
};

export function PrimaryButton({
  children,
  onPress,
  disabled,
  style,
  iconRight,
  iconLeft,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && pressedStyle,
        style,
      ]}
    >
      {iconLeft}
      <Text style={[styles.primaryButtonText, disabled && styles.primaryButtonTextDisabled]}>
        {children}
      </Text>
      {iconRight}
    </Pressable>
  );
}

type SecondaryButtonProps = ButtonProps & {
  textStyle?: StyleProp<TextStyle>;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

export function SecondaryButton({
  children,
  onPress,
  disabled,
  style,
  iconRight,
  iconLeft,
  textStyle,
  onPressIn,
  onPressOut,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.secondaryButtonDisabled,
        pressed && !disabled && pressedStyle,
        style,
      ]}
    >
      {iconLeft}
      <Text style={[styles.secondaryButtonText, textStyle]}>{children}</Text>
      {iconRight}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.inactiveOnDark,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  primaryButtonTextDisabled: {
    color: colors.textMuted,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
});
