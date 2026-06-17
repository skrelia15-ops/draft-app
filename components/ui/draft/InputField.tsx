import React, { forwardRef } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type InputFieldProps = TextInputProps & {
  label?: string;
  active?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const InputField = forwardRef<TextInput, InputFieldProps>(function InputField(
  { label, active, containerStyle, leading, trailing, style, ...inputProps },
  ref,
) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.inputLabel}>{label.toUpperCase()}</Text> : null}
      <View style={[styles.inputShell, active && styles.inputShellActive]}>
        {leading ? <View style={styles.inputLeading}>{leading}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...inputProps}
        />
        {trailing ? <View style={styles.inputTrailing}>{trailing}</View> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  inputLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    gap: spacing.xs,
  },
  inputShellActive: {
    borderColor: colors.primary,
  },
  inputLeading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.base,
    paddingVertical: spacing.sm,
  },
});
