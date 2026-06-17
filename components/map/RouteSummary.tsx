import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { trafficLevelColor } from '@/lib/ride';
import { colors, radius, spacing, typography } from '@/theme';

import type { RouteState } from './types';

export function RouteSummary({
  routeState,
  trafficVisible,
}: {
  routeState: RouteState;
  trafficVisible: boolean;
}) {
  /**
   * Traffic level inferred from the duration_in_traffic / duration ratio.
   * Only set for driving routes (Google Directions doesn't return traffic
   * for cycling).
   */
  const traffic = useMemo(() => {
    if (routeState.kind !== 'ready' || !routeState.route.trafficLevel) return null;
    const level = routeState.route.trafficLevel;
    return { level, color: trafficLevelColor(level) };
  }, [routeState]);

  if (routeState.kind === 'loading') {
    return (
      <View style={styles.statsRow}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.statsLoading}>Building route…</Text>
      </View>
    );
  }

  if (routeState.kind !== 'ready') return null;

  const r = routeState.route;
  const eta = r.durationInTrafficText ?? r.durationText;
  const showTrafficDelta =
    !!r.durationInTrafficText &&
    r.durationInTrafficText !== r.durationText &&
    !!traffic &&
    traffic.level !== 'CLEAR';

  return (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>DISTANCE</Text>
          <Text style={styles.statValue}>{r.distanceText}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>ETA</Text>
          <Text style={styles.statValue}>{eta}</Text>
          {showTrafficDelta && (
            <Text style={styles.statSub}>normally {r.durationText}</Text>
          )}
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>MODE</Text>
          <Text style={styles.statValue}>
            {r.mode === 'bicycling' ? 'CYCLE' : r.mode === 'driving' ? 'DRIVE' : 'WALK'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {traffic && (
          <View style={styles.trafficBadge}>
            <View style={[styles.trafficDot, { backgroundColor: traffic.color }]} />
            <Text style={styles.trafficText}>
              TRAFFIC · {traffic.level}
            </Text>
          </View>
        )}
        {traffic?.level === 'HEAVY' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>
              {r.alternativeCount > 0
                ? `${r.alternativeCount} alternate route${r.alternativeCount === 1 ? '' : 's'} available`
                : 'Consider a suggested loop instead'}
            </Text>
          </View>
        )}
        {!traffic && trafficVisible && r.mode === 'bicycling' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>LIVE TRAFFIC LAYER ACTIVE</Text>
          </View>
        )}
        {r.mode !== 'bicycling' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>
              Cycling not available, showing {r.mode} route
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  statsLoading: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing['3xs'],
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
  },
  statSub: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    marginTop: spacing['3xs'],
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  trafficBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  trafficText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  fallbackBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing['2xs'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  fallbackText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
  },
});
