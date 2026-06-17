import { type RideSegment } from '@/lib/ride';
import { colors, radius, spacing, typography } from '@/theme';
import {
  Cup,
  DangerCircle,
} from '@solar-icons/react-native/Linear';
import { StyleSheet, Text, View } from 'react-native';

export function SegmentTimeline({ segments }: { segments: RideSegment[] }) {
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

export { SegmentCallout };

const styles = StyleSheet.create({
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
});
