import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { cardBase, pressedStyle } from './_shared';

export type CardProps = {
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
        style={({ pressed }) => [cardStyle, style, pressed && pressedStyle]}
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

const styles = StyleSheet.create({
  tabBar: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.hairline,
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
});
