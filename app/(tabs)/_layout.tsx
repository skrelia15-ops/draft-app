import { Tabs, router, Href } from 'expo-router';
import { Pressable, View, StyleSheet } from 'react-native';
import { Bolt } from '@solar-icons/react-native/Bold';
import {
  Pulse2,
  Map as MapIcon,
  UsersGroupTwoRounded,
  User,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';

type IconRenderProps = { focused: boolean; color: string; size: number };

const TAB_BAR_HEIGHT = 70;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: IconRenderProps) => (
            <Pulse2 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }: IconRenderProps) => (
            <MapIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="draft-action"
        options={{
          title: '',
          tabBarButton: () => (
            <Pressable
              style={styles.centerButton}
              onPress={() => router.push('/ride/plan' as Href)}
            >
              <View style={styles.centerButtonInner}>
                <Bolt size={28} color={colors.textOnPrimary} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }: IconRenderProps) => (
            <UsersGroupTwoRounded size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: IconRenderProps) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    height: TAB_BAR_HEIGHT,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderTopWidth: 0,
    borderRadius: radius['3xl'],
    backgroundColor: 'transparent',
    elevation: 0,
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['3xl'],
  },
  tabItem: {
    paddingTop: spacing.xs,
  },
  tabLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginTop: spacing['3xs'],
  },
  centerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -spacing.xl,
  },
  centerButtonInner: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
