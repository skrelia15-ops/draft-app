import { colors, radius, spacing, typography } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const GAUGE_SIZE = 280;
const GAUGE_STROKE = 6;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS;

export function EfficiencyGauge({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <View style={styles.gaugeWrap}>
      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        <Circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          stroke={colors.surfaceElevated}
          strokeWidth={GAUGE_STROKE}
          fill="none"
        />
        <Circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          stroke={colors.primary}
          strokeWidth={GAUGE_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRC}
          strokeDashoffset={GAUGE_CIRC * (1 - clamped)}
          transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.gaugeContent}>
        <Text style={styles.gaugeLabel}>DRAFT EFFICIENCY</Text>
        <Text style={styles.gaugeValue}>{Math.round(percent)}%</Text>
        <View style={styles.gaugeBars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.gaugeBar,
                i < Math.round(clamped * 5) && styles.gaugeBarActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeWrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  gaugeValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'],
    marginBottom: spacing.sm,
  },
  gaugeBars: {
    flexDirection: 'row',
    gap: spacing['2xs'],
  },
  gaugeBar: {
    width: 6,
    height: 14,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceElevated,
  },
  gaugeBarActive: {
    backgroundColor: colors.primary,
  },
});
