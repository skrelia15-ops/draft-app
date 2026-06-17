import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { pressedStyle } from './_shared';

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
                  pressed && pressedStyle,
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
                pressed && pressedStyle,
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
    borderColor: colors.hairline,
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
