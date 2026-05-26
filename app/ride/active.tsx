import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pause, Play, Stop, MapArrowRight } from '@solar-icons/react-native/Linear';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme';
import {
  formatDistanceMeters,
  formatHourMin,
  formatMmSs,
  useRide,
} from '@/lib/ride';

const GAUGE_SIZE = 280;
const GAUGE_STROKE = 6;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS;

function EfficiencyGauge({ percent }: { percent: number }) {
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

export default function ActiveRideScreen() {
  const insets = useSafeAreaInsets();
  const {
    phase,
    liveStats,
    routeName,
    startRide,
    pauseRide,
    resumeRide,
    finishRide,
  } = useRide();

  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety net: if the user landed here without a started ride (e.g. on
  // refresh during dev), kick off an empty one so they don't get stuck on
  // a frozen screen.
  useEffect(() => {
    if (phase === 'idle') {
      startRide({ routeName: 'Free ride' });
    }
  }, [phase, startRide]);

  const handleHoldIn = () => {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      finishRide();
      router.push('/ride/complete' as Href);
    }, 1200);
  };

  const handleHoldOut = () => {
    setHolding(false);
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const paused = phase === 'paused';

  // ── Display helpers ──────────────────────────────────────────────────
  const speedText = liveStats.speedKmh.toFixed(1);
  const energyText = `${liveStats.wattsSavedNow}W`;
  const elapsedText = formatMmSs(liveStats.elapsedSec);
  const distanceText = formatDistanceMeters(liveStats.distanceMeters);
  const remainingText =
    liveStats.remainingMeters != null
      ? formatDistanceMeters(liveStats.remainingMeters)
      : '—';
  const etaText =
    liveStats.etaSec != null && liveStats.etaSec < 60 * 60 * 12
      ? `${formatHourMin(liveStats.etaSec)} TO GO`
      : routeName
        ? 'EN ROUTE'
        : 'FREE RIDE';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.velocityLabel}>VELOCITY</Text>
          <View style={styles.velocityRow}>
            <Text style={styles.velocity}>{speedText}</Text>
            <Text style={styles.velocityUnit}>KMH</Text>
          </View>
          <Text style={styles.subStat}>
            AVG {liveStats.avgSpeedKmh.toFixed(1)} · {distanceText}
          </Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.energyCard}>
            <Text style={styles.energyLabel}>SAVED NOW</Text>
            <Text style={styles.energyValue}>{energyText}</Text>
          </View>
          <Text style={styles.timer}>{elapsedText}</Text>
        </View>
      </View>

      <View style={styles.gaugeArea}>
        <EfficiencyGauge percent={liveStats.draftEfficiencyPercent} />
      </View>

      <View style={styles.maneuverCard}>
        <View style={styles.maneuverIcon}>
          <MapArrowRight size={24} color={colors.textOnPrimary} />
        </View>
        <View style={styles.maneuverBody}>
          <Text style={styles.maneuverLabel}>
            {routeName ? 'HEADING TO' : 'STATUS'}
          </Text>
          <Text style={styles.maneuverText} numberOfLines={1}>
            {routeName ?? 'FREE RIDE'}
          </Text>
          <Text style={styles.maneuverSub}>
            {liveStats.drafting ? 'In the slipstream' : 'Riding solo'} · {etaText}
          </Text>
        </View>
        <View style={styles.remainingBlock}>
          <Text style={styles.remainingLabel}>REMAINING</Text>
          <Text style={styles.remainingValue}>{remainingText}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.pauseButton}
          onPress={paused ? resumeRide : pauseRide}
        >
          {paused ? (
            <Play size={22} color={colors.textOnDark} />
          ) : (
            <Pause size={22} color={colors.textOnDark} />
          )}
        </Pressable>
        <Pressable
          style={[styles.finishButton, holding && styles.finishButtonActive]}
          onPressIn={handleHoldIn}
          onPressOut={handleHoldOut}
        >
          <Stop size={20} color={holding ? colors.textOnPrimary : colors.textOnDark} />
          <Text
            style={[styles.finishText, holding && styles.finishTextActive]}
          >
            HOLD TO FINISH
          </Text>
        </Pressable>
      </View>

      {paused && (
        <PauseOverlay
          elapsedText={elapsedText}
          distanceText={distanceText}
          avgSpeedText={`${liveStats.avgSpeedKmh.toFixed(1)} km/h`}
          onResume={resumeRide}
          onEnd={() => {
            finishRide();
            router.push('/ride/complete' as Href);
          }}
        />
      )}
    </View>
  );
}

function PauseOverlay({
  elapsedText,
  distanceText,
  avgSpeedText,
  onResume,
  onEnd,
}: {
  elapsedText: string;
  distanceText: string;
  avgSpeedText: string;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.overlayDim} />
      <View style={styles.overlayCard}>
        <Text style={styles.overlayBadge}>PAUSED</Text>
        <Text style={styles.overlayTitle}>RIDE ON HOLD</Text>
        <Text style={styles.overlayBody}>
          Stats are frozen. Time, distance and energy stop counting until you
          resume.
        </Text>
        <View style={styles.overlayStats}>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>TIME</Text>
            <Text style={styles.overlayStatValue}>{elapsedText}</Text>
          </View>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>DISTANCE</Text>
            <Text style={styles.overlayStatValue}>{distanceText}</Text>
          </View>
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatLabel}>AVG SPEED</Text>
            <Text style={styles.overlayStatValue}>{avgSpeedText}</Text>
          </View>
        </View>
        <Pressable style={styles.overlayPrimary} onPress={onResume}>
          <Play size={18} color={colors.textOnPrimary} />
          <Text style={styles.overlayPrimaryText}>RESUME</Text>
        </Pressable>
        <Pressable style={styles.overlayGhost} onPress={onEnd}>
          <Text style={styles.overlayGhostText}>END RIDE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  velocityLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  velocityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  velocity: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'] + 16,
    lineHeight: typography.size['3xl'] + 18,
  },
  velocityUnit: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  subStat: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing['3xs'],
  },
  topRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  energyCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  energyLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  energyValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  timer: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.base,
  },
  gaugeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  maneuverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  maneuverIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maneuverBody: {
    flex: 1,
  },
  maneuverLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  maneuverText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  maneuverSub: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
  },
  remainingBlock: {
    alignItems: 'flex-end',
  },
  remainingLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  remainingValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pauseButton: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButton: {
    flex: 1,
    height: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonActive: {
    backgroundColor: colors.primary,
  },
  finishText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  finishTextActive: {
    color: colors.textOnPrimary,
  },

  // Pause overlay — sits on top of the live screen so the user keeps
  // their context. Stats remain visible (and frozen) underneath.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,17,17,0.65)',
  },
  overlayCard: {
    backgroundColor: colors.surfaceElevated,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  overlayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.textOnPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['3xs'],
    borderRadius: radius.pill,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    overflow: 'hidden',
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing['2xs'],
  },
  overlayBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing.xs,
  },
  overlayStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.inactiveOnDark,
    marginBottom: spacing.xs,
  },
  overlayStat: {
    flex: 1,
  },
  overlayStatLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  overlayStatValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
  },
  overlayPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  overlayPrimaryText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  overlayGhost: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  overlayGhostText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
});
