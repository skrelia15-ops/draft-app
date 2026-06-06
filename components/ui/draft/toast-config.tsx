import { Text, View, StyleSheet } from 'react-native';
import {
  CheckCircle,
  DangerCircle,
  InfoCircle,
} from '@solar-icons/react-native/Bold';
import {
  BaseToastProps,
  ToastConfig,
} from 'react-native-toast-message';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Brand-styled toast templates passed to `<Toast config={...} />`.
 *
 * Three variants: success (yellow accent), error (red accent), info
 * (white). All sit on the dark surface so they stand out against the
 * (mostly dark) app while staying inside the design system.
 */

function Row({
  icon,
  accent,
  text1,
  text2,
}: {
  icon: React.ReactNode;
  accent: string;
  text1?: string;
  text2?: string;
}) {
  return (
    <View style={styles.shell}>
      <View style={[styles.iconBox, { backgroundColor: accent }]}>
        {icon}
      </View>
      <View style={styles.body}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <Row
      icon={<CheckCircle size={18} color={colors.textOnPrimary} />}
      accent={colors.primary}
      text1={text1}
      text2={text2}
    />
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <Row
      icon={<DangerCircle size={18} color={colors.textOnDark} />}
      accent="#E5484D"
      text1={text1}
      text2={text2}
    />
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <Row
      icon={<InfoCircle size={18} color={colors.textOnDark} />}
      accent={colors.inactiveOnDark}
      text1={text1}
      text2={text2}
    />
  ),
};

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '92%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
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
