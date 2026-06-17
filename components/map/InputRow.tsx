import { CloseCircle, MapPoint } from '@solar-icons/react-native/Linear';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import type { Field } from './types';

export function InputRow({
  inputRef,
  value,
  placeholder,
  dot,
  active,
  onFocus,
  onBlur,
  onChangeText,
  onClear,
  onPickOnMap,
  showClear,
}: {
  which: Field;
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  placeholder: string;
  dot: React.ReactNode;
  active: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (t: string) => void;
  onClear: () => void;
  onPickOnMap: () => void;
  showClear: boolean;
}) {
  return (
    <View style={[styles.inputField, active && styles.inputFieldActive]}>
      {dot}
      <TextInput
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.inputText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {showClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={spacing.xs}
          style={styles.inputAction}
        >
          <CloseCircle size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPickOnMap}
        hitSlop={spacing.xs}
        style={styles.inputAction}
      >
        <MapPoint size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  inputFieldActive: {
    borderColor: colors.primary,
  },
  inputText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    paddingVertical: spacing.xs,
  },
  inputAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
