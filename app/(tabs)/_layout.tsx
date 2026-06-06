import { colors, radius, spacing } from '@/theme';
import { Bolt } from '@solar-icons/react-native/Bold';
// Active variant — filled silhouettes
import {
  Home as HomeBold,
  Map as MapIconBold,
  User as UserBold,
  UsersGroupTwoRounded as UsersGroupTwoRoundedBold,
} from '@solar-icons/react-native/Bold';
// Default variant — line/outline icons
import {
  Home as HomeLinear,
  Map as MapIconLinear,
  User as UserLinear,
  UsersGroupTwoRounded as UsersGroupTwoRoundedLinear,
} from '@solar-icons/react-native/Linear';
import { Href, Tabs, router, usePathname } from 'expo-router';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Tab bar — ported 1:1 from Figma node 8021:317.
 *
 * Why every slot is a custom `tabBarButton`:
 * react-navigation v7's bottom tabs internally wrap each icon in a
 * column flexbox that reserves space for a text label, even with
 * `tabBarShowLabel: false`. That pushes the icon to the TOP of the slot
 * instead of centering it. We bypass that entirely by rendering each
 * slot ourselves — 64×64 box, icon centered with flex, no label space.
 *
 * Structure:
 *   • White pill (#FFFFFF), 100px radius, 4px padding all sides
 *   • 5 inline 64×64 slots — Home / Map / Logo (yellow) / Group / User
 *   • Each icon = 28×28 perfectly centered inside its 64×64 slot
 *   • Total bar height = 4 + 64 + 4 = 72px
 */
const SLOT_SIZE = 64;
const ICON_SIZE = 28;
const BAR_PADDING = 4;
const TAB_BAR_HEIGHT = SLOT_SIZE + BAR_PADDING * 2;

type IconCmp = ComponentType<{ size?: number; color?: string }>;

/**
 * Renders one tab slot. Used as `tabBarButton` for every screen so the
 * layout is identical across all 5 positions — no react-navigation
 * default padding can sneak in.
 *
 * Each slot gets BOTH icon variants: linear (outline) for default and
 * bold (filled) for active. Active detection uses `usePathname()`
 * instead of react-navigation's `accessibilityState.selected` because
 * the latter doesn't always propagate reliably when a custom
 * `tabBarButton` is provided (we render Pressable ourselves, so the
 * library's internal focus signal doesn't reach our component).
 */
function TabSlot({
  iconLinear: IconLinear,
  iconBold: IconBold,
  match,
  buttonProps,
}: {
  iconLinear: IconCmp;
  iconBold: IconCmp;
  /** Pathname prefix that means "this tab is active". */
  match: string;
  buttonProps: BottomTabBarButtonProps;
}) {
  const { onPress, accessibilityState } = buttonProps;
  const pathname = usePathname();
  const focused = isPathActive(pathname, match);
  const Icon = focused ? IconBold : IconLinear;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, selected: focused }}
      style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
    >
      <Icon size={ICON_SIZE} color={colors.textOnLight} />
    </Pressable>
  );
}

/**
 * `/` matches the Home tab. Other tabs match their exact pathname.
 * Treat `/` as a strict equality check — otherwise EVERY tab would
 * count as active when on Home.
 */
function isPathActive(pathname: string, match: string): boolean {
  if (match === '/') return pathname === '/' || pathname === '';
  return pathname === match || pathname.startsWith(match + '/');
}

/** The middle slot — a yellow 64×64 ride button. */
function RideSlot() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a ride"
      onPress={() => router.push('/ride/map' as Href)}
      style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
    >
      <View style={styles.rideCircle}>
        <Bolt size={ICON_SIZE} color={colors.textOnPrimary} />
      </View>
    </Pressable>
  );
}

/** Tiny helper so each tabBarButton can pass both icon variants inline. */
function withIcon(
  linear: IconCmp,
  bold: IconCmp,
  match: string,
): (p: BottomTabBarButtonProps) => ReactNode {
  const Renderer = (props: BottomTabBarButtonProps) => (
    <TabSlot
      iconLinear={linear}
      iconBold={bold}
      match={match}
      buttonProps={props}
    />
  );
  Renderer.displayName = `TabSlot(${linear.displayName ?? 'Icon'})`;
  return Renderer;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, spacing.sm);

  return (
    <Tabs
      screenOptions={
        {
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: [
            styles.tabBar,
            { bottom: safeBottom, height: TAB_BAR_HEIGHT },
          ],
          tabBarBackground: () => <View style={styles.tabBarBackground} />,
          tabBarShowLabel: false,
          tabBarIndicatorStyle: { height: 0 },
          tabBarPressColor: 'transparent',
          tabBarPressOpacity: 0.7,
        } as React.ComponentProps<typeof Tabs>['screenOptions']
      }
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButton: withIcon(HomeLinear, HomeBold, '/'),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarButton: withIcon(MapIconLinear, MapIconBold, '/explore'),
        }}
      />
      <Tabs.Screen
        name="draft-action"
        options={{ title: '', tabBarButton: () => <RideSlot /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarButton: withIcon(
            UsersGroupTwoRoundedLinear,
            UsersGroupTwoRoundedBold,
            '/groups',
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButton: withIcon(UserLinear, UserBold, '/profile'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    // 20px side gap so the pill floats with the same inset as the rest
    // of the layout (cards / sections use `spacing.lg` = 20).
    //
    // Must use `marginHorizontal`, NOT `left`/`right`: the library's
    // base tab-bar style sets the logical `start: 0`/`end: 0` insets,
    // and in Yoga those take precedence over the physical `left`/`right`
    // — so `left`/`right` here would be silently ignored and the bar
    // would stick to the screen edges. `marginHorizontal` insets the
    // (full-width) absolute bar regardless of that conflict.
    marginHorizontal: spacing.lg,
    paddingTop: BAR_PADDING,
    paddingBottom: BAR_PADDING,
    paddingHorizontal: BAR_PADDING,
    borderTopWidth: 0,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.pill,
    // Tighter shadow that drops downward, not sideways — keeps the
    // side margin visually intact.
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  // Every slot is a flex:1 box that centers its child both axes. This
  // single style governs ALL 5 positions, so the row reads as 5 equal
  // 64-tall boxes with their icon perfectly in the middle.
  slot: {
    flex: 1,
    height: SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPressed: {
    opacity: 0.7,
  },
  rideCircle: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
