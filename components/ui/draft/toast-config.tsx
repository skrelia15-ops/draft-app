import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View, StyleSheet } from 'react-native';
import {
  CheckCircle,
  DangerCircle,
  InfoCircle,
} from '@solar-icons/react-native/Bold';
import {
  ToastConfig,
  ToastConfigParams,
} from 'react-native-toast-message';
import { colors, radius, spacing, typography } from '@/theme';

/** Fallback if a caller shows a toast without going through lib/toast.ts. */
const FALLBACK_DURATION_MS = 4000;

/**
 * Brand-styled toast templates passed to `<Toast config={...} />`.
 *
 * Three variants: success (yellow accent), error (red accent), info
 * (white). All sit on the dark surface so they stand out against the
 * (mostly dark) app while staying inside the design system.
 */

/** Linear countdown bar that drains over `durationMs`, mirroring how long
 *  the toast stays on screen so the user can see the time remaining. */
function ProgressBar({ accent, durationMs }: { accent: string; durationMs: number }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [durationMs, progress]);
  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { backgroundColor: accent, width }]} />
    </View>
  );
}

function Row({
  icon,
  accent,
  text1,
  text2,
  durationMs,
}: {
  icon: React.ReactNode;
  accent: string;
  text1?: string;
  text2?: string;
  durationMs: number;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.rowTop}>
        <View style={[styles.iconBox, { backgroundColor: accent }]}>
          {icon}
        </View>
        <View style={styles.body}>
          {text1 ? <Text style={styles.title}>{text1}</Text> : null}
          {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
        </View>
      </View>
      <ProgressBar accent={accent} durationMs={durationMs} />
    </View>
  );
}

function durationFrom(props: unknown): number {
  const d = (props as { durationMs?: number } | undefined)?.durationMs;
  return typeof d === 'number' && d > 0 ? d : FALLBACK_DURATION_MS;
}

type ToastParams = ToastConfigParams<{ durationMs?: number }>;

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, props }: ToastParams) => (
    <Row
      icon={<CheckCircle size={18} color={colors.textOnPrimary} />}
      accent={colors.primary}
      text1={text1}
      text2={text2}
      durationMs={durationFrom(props)}
    />
  ),
  error: ({ text1, text2, props }: ToastParams) => (
    <Row
      icon={<DangerCircle size={18} color={colors.textOnDark} />}
      accent={colors.danger}
      text1={text1}
      text2={text2}
      durationMs={durationFrom(props)}
    />
  ),
  info: ({ text1, text2, props }: ToastParams) => (
    <Row
      icon={<InfoCircle size={18} color={colors.textOnDark} />}
      accent={colors.inactiveOnDark}
      text1={text1}
      text2={text2}
      durationMs={durationFrom(props)}
    />
  ),
};

const styles = StyleSheet.create({
  shell: {
    width: '92%',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.inactiveOnDark,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
});
