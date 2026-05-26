import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUp,
  ArrowDown,
  Bolt,
  Cup,
  DangerCircle,
  Lightbulb,
} from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';
import {
  computeInsights,
  formatDistanceMeters,
  formatHourMin,
  useRide,
  type RideRecord,
  type RideSegment,
} from '@/lib/ride';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { lastFinished, history, acknowledgeFinished } = useRide();

  const previous = useMemo(() => {
    if (!lastFinished) return null;
    return history.find((r) => r.id !== lastFinished.id) ?? null;
  }, [history, lastFinished]);

  const insights = useMemo(() => {
    if (!lastFinished) return null;
    return computeInsights(lastFinished, previous);
  }, [lastFinished, previous]);

  const averageComparison = useMemo(() => {
    if (!lastFinished) return null;
    const previousRides = history.filter((r) => r.id !== lastFinished.id);
    return compareToAverage(lastFinished, previousRides);
  }, [history, lastFinished]);

  const handleGoHome = () => {
    acknowledgeFinished();
    router.dismissAll();
    router.replace('/(tabs)' as Href);
  };

  if (!lastFinished || !insights) {
    return (
      <View style={[styles.container, styles.emptyWrap]}>
        <Text style={styles.title}>RIDE INSIGHTS</Text>
        <Text style={styles.subtitle}>No ride captured yet.</Text>
        <Pressable
          style={[styles.dashboardButton, { marginTop: spacing.xl }]}
          onPress={handleGoHome}
        >
          <Text style={styles.dashboardText}>GO TO HOMEPAGE</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>RIDE INSIGHTS</Text>
        <Text style={styles.subtitle}>
          {insights.draftingPercent >= 60
            ? 'You spent most of the ride in the slipstream.'
            : 'There\u2019s still room to save more energy.'}
        </Text>

        <View style={styles.coreStatsGrid}>
          <CoreStat
            label="Distance"
            value={formatDistanceMeters(lastFinished.distanceMeters)}
          />
          <CoreStat
            label="Avg speed"
            value={`${lastFinished.avgSpeedKmh.toFixed(1)} km/h`}
          />
          <CoreStat
            label="Total time"
            value={formatHourMin(lastFinished.durationSec)}
          />
        </View>

        {/* Headline: energy saved */}
        <View style={styles.energyCard}>
          <Bolt size={36} color={colors.primary} />
          <View style={styles.energyValueRow}>
            <Text style={styles.energyValue}>{insights.energySavedPercent}%</Text>
            <Text style={styles.energyUnit}>SAVED VS SOLO</Text>
          </View>
          <Text style={styles.energyLabel}>
            {insights.energySavedWatts}W AVG · {formatDistanceMeters(lastFinished.distanceMeters)}
          </Text>
          {insights.comparison && (
            <ComparisonBadge comparison={insights.comparison} />
          )}
          {averageComparison && (
            <Text style={styles.averageComparison}>{averageComparison}</Text>
          )}
        </View>

        {/* Drafting vs solo split */}
        <Text style={styles.sectionTitle}>TIME BREAKDOWN</Text>
        <SplitBar
          drafting={insights.draftingPercent}
          solo={insights.soloPercent}
        />
        <View style={styles.splitLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendLabel}>Drafting</Text>
            <Text style={styles.legendValue}>{insights.draftingPercent}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: colors.textSubtle }]}
            />
            <Text style={styles.legendLabel}>Solo</Text>
            <Text style={styles.legendValue}>{insights.soloPercent}%</Text>
          </View>
        </View>

        {/* Best / worst segments */}
        {insights.bestSegment && (
          <SegmentCallout
            title="BEST DRAFTING SEGMENT"
            icon="best"
            segment={insights.bestSegment}
          />
        )}
        {insights.worstSegment &&
          insights.worstSegment.index !== insights.bestSegment?.index && (
            <SegmentCallout
              title="WORST SEGMENT"
              icon="worst"
              segment={insights.worstSegment}
            />
          )}

        {/* Segment timeline */}
        {lastFinished.segments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SEGMENT TIMELINE</Text>
            <SegmentTimeline segments={lastFinished.segments} />
          </>
        )}

        {/* Missed opportunities */}
        {insights.missedOpportunities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>MISSED OPPORTUNITIES</Text>
            {insights.missedOpportunities.map((line) => (
              <View key={line} style={styles.bulletRow}>
                <DangerCircle size={16} color={colors.primary} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </>
        )}

        {/* Recommendations */}
        {insights.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>INSIGHTS</Text>
            {insights.recommendations.map((tip) => (
              <View key={tip} style={styles.bulletRow}>
                <Lightbulb size={16} color={colors.primary} />
                <Text style={styles.bulletText}>{tip}</Text>
              </View>
            ))}
          </>
        )}

        {/* Potential extra savings */}
        {insights.potentialExtraEnergyPercent >= 3 && (
          <View style={styles.potentialCard}>
            <Text style={styles.potentialLabel}>POTENTIAL</Text>
            <Text style={styles.potentialValue}>
              +{insights.potentialExtraEnergyPercent}%
            </Text>
            <Text style={styles.potentialBody}>
              if you\u2019d drafted the whole route at this pace
            </Text>
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[
          styles.dashboardButton,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
        onPress={handleGoHome}
      >
        <Text style={styles.dashboardText}>GO TO HOMEPAGE</Text>
      </Pressable>
    </View>
  );
}

function CoreStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.coreStat}>
      <Text style={styles.coreStatLabel}>{label}</Text>
      <Text style={styles.coreStatValue}>{value}</Text>
    </View>
  );
}

function compareToAverage(current: RideRecord, history: RideRecord[]): string | null {
  if (history.length === 0) return null;
  const avgSpeed =
    history.reduce((sum, ride) => sum + ride.avgSpeedKmh, 0) / history.length;
  const avgDraft =
    history.reduce((sum, ride) => sum + ride.draftingFraction, 0) /
    history.length;
  const speedDelta = current.avgSpeedKmh - avgSpeed;
  const draftDelta = (current.draftingFraction - avgDraft) * 100;
  const speedText =
    Math.abs(speedDelta) < 0.5
      ? 'matched your average pace'
      : `${Math.abs(speedDelta).toFixed(1)} km/h ${
          speedDelta > 0 ? 'faster' : 'slower'
        } than average`;
  const draftText =
    Math.abs(draftDelta) < 2
      ? 'with similar drafting time'
      : `${Math.abs(Math.round(draftDelta))}% ${
          draftDelta > 0 ? 'more' : 'less'
        } drafting than average`;
  return `Vs average ride: ${speedText}, ${draftText}.`;
}

function ComparisonBadge({
  comparison,
}: {
  comparison: NonNullable<ReturnType<typeof computeInsights>['comparison']>;
}) {
  const Icon =
    comparison.direction === 'up'
      ? ArrowUp
      : comparison.direction === 'down'
        ? ArrowDown
        : null;
  const tone =
    comparison.direction === 'up'
      ? colors.primary
      : comparison.direction === 'down'
        ? colors.textMuted
        : colors.textMuted;
  return (
    <View style={[styles.comparisonRow, { borderColor: tone }]}>
      {Icon ? (
        <Icon size={14} color={tone} />
      ) : (
        <View style={[styles.comparisonDash, { backgroundColor: tone }]} />
      )}
      <Text style={[styles.comparisonText, { color: tone }]} numberOfLines={2}>
        {comparison.summary}
      </Text>
    </View>
  );
}

function SplitBar({ drafting, solo }: { drafting: number; solo: number }) {
  const draftingClamped = Math.max(0, Math.min(100, drafting));
  const soloClamped = Math.max(0, 100 - draftingClamped);
  return (
    <View style={styles.splitBar}>
      <View
        style={[
          styles.splitBarFill,
          { backgroundColor: colors.primary, flex: draftingClamped },
        ]}
      />
      <View
        style={[
          styles.splitBarFill,
          { backgroundColor: colors.textSubtle, flex: soloClamped },
        ]}
      />
    </View>
  );
}

function SegmentTimeline({ segments }: { segments: RideSegment[] }) {
  return (
    <View style={styles.timelineRow}>
      {segments.map((seg) => (
        <View
          key={seg.index}
          style={[
            styles.timelineSeg,
            {
              backgroundColor:
                seg.draftEfficiency >= 50 ? colors.primary : colors.textSubtle,
              opacity: 0.5 + (seg.draftEfficiency / 100) * 0.5,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SegmentCallout({
  title,
  icon,
  segment,
}: {
  title: string;
  icon: 'best' | 'worst';
  segment: RideSegment;
}) {
  const Icon = icon === 'best' ? Cup : DangerCircle;
  return (
    <View style={styles.calloutCard}>
      <View style={styles.calloutHeader}>
        <Icon size={16} color={colors.primary} />
        <Text style={styles.calloutTitle}>{title}</Text>
      </View>
      <Text style={styles.calloutMeta}>
        KM {segment.startKm.toFixed(1)} – {segment.endKm.toFixed(1)} · {segment.draftEfficiency}% IN DRAFT
      </Text>
      <Text style={styles.calloutLabel}>{segment.label}</Text>
      <Text style={styles.calloutSub}>
        AVG {segment.avgSpeedKmh.toFixed(1)} KM/H
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['2xs'],
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    marginBottom: spacing.xl,
  },
  energyCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  coreStatsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  coreStat: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  coreStatLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  coreStatValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
  },
  energyValueRow: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  energyValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['3xl'],
  },
  energyUnit: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontStyle: 'italic',
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginTop: spacing['3xs'],
  },
  energyLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    marginBottom: spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  comparisonDash: {
    width: 10,
    height: 2,
    borderRadius: radius.pill,
  },
  comparisonText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    flexShrink: 1,
  },
  averageComparison: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  splitBar: {
    height: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  splitBarFill: {
    height: '100%',
  },
  splitLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  legendLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  legendValue: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
  },
  calloutCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing['2xs'],
  },
  calloutTitle: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wider,
  },
  calloutMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['2xs'],
  },
  calloutLabel: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginBottom: spacing['3xs'],
  },
  calloutSub: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 3,
    height: 28,
    alignItems: 'stretch',
    marginBottom: spacing.sm,
  },
  timelineSeg: {
    flex: 1,
    borderRadius: radius.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bulletText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  potentialCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  potentialLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wider,
  },
  potentialValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    marginTop: spacing.xs,
    marginBottom: spacing['2xs'],
  },
  potentialBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  dashboardButton: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  dashboardText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
});
