import React, { forwardRef } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

// Re-export sibling components so screens can pull everything from
// `@/components/ui/draft` regardless of which file owns each piece.
export { GoalsCard, buildGoalDays, type Goal } from './GoalsCard';

export const ui = {
  softShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

const cardBase = {
  backgroundColor: colors.surfaceElevated,
  borderRadius: radius.xl,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
} as const;

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function CardShell({ children, style, onPress, onLayout, cardStyle }: CardProps & { cardStyle: ViewStyle }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onLayout={onLayout}
        style={({ pressed }) => [cardStyle, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View onLayout={onLayout} style={[cardStyle, style]}>
      {children}
    </View>
  );
}

export function TabBar() {
  return <View style={styles.tabBar} />;
}

export function ElevatedCard(props: CardProps) {
  return <CardShell {...props} cardStyle={styles.elevatedCard} />;
}

export function PrimaryCard(props: CardProps) {
  return <CardShell {...props} cardStyle={styles.primaryCard} />;
}

export function HighlightCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.highlightCard, style]}>{children}</View>;
}

type ListItemCardProps = CardProps & {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export function ListItemCard({ children, style, onPress, leading, trailing }: ListItemCardProps) {
  return (
    <CardShell {...{ onPress, style }} cardStyle={styles.listItemCard}>
      {leading ? <View style={styles.listLeading}>{leading}</View> : null}
      <View style={styles.listBody}>{children}</View>
      {trailing ? <View style={styles.listTrailing}>{trailing}</View> : null}
    </CardShell>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  context?: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StatCard({ label, value, context, accent, style }: StatCardProps) {
  return (
    <View style={[styles.statCard, style]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      {context ? <Text style={styles.statContext}>{context}</Text> : null}
    </View>
  );
}

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
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

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
        pressed && !disabled && styles.pressed,
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
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {iconLeft}
      <Text style={[styles.secondaryButtonText, textStyle]}>{children}</Text>
      {iconRight}
    </Pressable>
  );
}

type SegmentedTabsProps<T extends string> = {
  /** Stable identifier list (also used as label text by default). */
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Optional label override (`option -> displayed text`). */
  labelFor?: (option: T) => string;
  /** Render style — defaults to `underline`. */
  variant?: 'underline' | 'pill';
  /** Horizontal padding applied to the scroll content. */
  contentInsetHorizontal?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Reusable horizontally-scrolling tab strip — used for "WITH DRAFT /
 * SCENIC / POPULAR …" style filters across the app. Pick ONE visual
 * variant (`underline` is the default) and stick with it; mixing pill +
 * underline reads as two competing affordances.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  labelFor,
  variant = 'underline',
  contentInsetHorizontal,
  style,
}: SegmentedTabsProps<T>) {
  return (
    <View style={[styles.segmentedTabsRow, style]}>
      <View
        style={[
          styles.segmentedTabsTrack,
          contentInsetHorizontal != null && {
            paddingHorizontal: contentInsetHorizontal,
          },
        ]}
      >
        {options.map((option) => {
          const active = option === value;
          const label = labelFor ? labelFor(option) : option;

          if (variant === 'pill') {
            return (
              <Pressable
                key={option}
                onPress={() => onChange(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.segmentedPill,
                  active && styles.segmentedPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentedPillText,
                    active && styles.segmentedPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.segmentedUnderlineItem,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentedUnderlineText,
                  active && styles.segmentedUnderlineTextActive,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.segmentedUnderlineBar,
                  active && styles.segmentedUnderlineBarActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SegmentedProgressProps = {
  achieved: number;
  activeIndex: number;
  labels: string[];
};

export function SegmentedProgress({ achieved, activeIndex, labels }: SegmentedProgressProps) {
  return (
    <View>
      <View style={styles.segmentRow}>
        {labels.map((label, index) => {
          const filled = index < achieved;
          const active = index === activeIndex;
          return (
            <View key={`${label}-${index}`} style={styles.segmentCell}>
              <View
                style={[
                  styles.segmentBar,
                  filled && styles.segmentBarFilled,
                  active && styles.segmentBarActive,
                ]}
              />
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88,
  },
  tabBar: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  elevatedCard: {
    ...cardBase,
  },
  primaryCard: {
    ...cardBase,
    borderColor: 'rgba(246,235,76,0.25)',
  },
  highlightCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  listItemCard: {
    ...cardBase,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listLeading: {
    alignSelf: 'center',
  },
  listBody: {
    flex: 1,
  },
  listTrailing: {
    alignSelf: 'center',
  },
  statCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  statValueAccent: {
    color: colors.primary,
  },
  statContext: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    marginTop: spacing['2xs'],
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(255,255,255,0.08)',
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
  segmentedTabsRow: {
    width: '100%',
  },
  segmentedTabsTrack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  // Tab item styling matches Figma node 8021:280 — 18px Darker Grotesque
  // Bold uppercase, full white on active vs 30% white on inactive, with
  // a yellow underline that only shows under the active label.
  segmentedUnderlineItem: {
    paddingVertical: spacing.xs,
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  segmentedUnderlineText: {
    color: 'rgba(241,241,241,0.3)',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.tight,
    textTransform: 'uppercase',
  },
  segmentedUnderlineTextActive: {
    color: colors.textOnDark,
  },
  segmentedUnderlineBar: {
    height: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  segmentedUnderlineBarActive: {
    backgroundColor: colors.primary,
    height: 1,
  },
  segmentedPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentedPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentedPillText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  segmentedPillTextActive: {
    color: colors.textOnPrimary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentCell: {
    flex: 1,
    alignItems: 'center',
  },
  segmentBar: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.inactiveOnDark,
    marginBottom: spacing.xs,
  },
  segmentBarFilled: {
    backgroundColor: colors.primary,
    opacity: 0.75,
  },
  segmentBarActive: {
    opacity: 1,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
  },
  segmentLabelActive: {
    color: colors.textOnDark,
  },
});
