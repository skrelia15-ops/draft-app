import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { Chip, Tag } from '@/components/ui/draft';
import { darkMapStyle, MAP_PROVIDER, type LatLng } from '@/lib/maps';
import { recommendRoutes, type Recommendation, type RouteCandidate } from '@/lib/ride';
import type { Conditions } from '@/lib/ride';
import type { CatalogRoute } from '@/lib/routes';
import type { Profile } from '@/lib/profile';
import { colors, radius, spacing, typography } from '@/theme';

type Mode = 'choose' | 'destination' | 'recommend';
const DURATIONS: { label: string; minutes: number | null }[] = [
  { label: '30 min', minutes: 30 }, { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 }, { label: 'Any', minutes: null },
];

export type SmartPanelProps = {
  catalog: CatalogRoute[];
  origin: LatLng | null;
  conditions: Conditions;
  profile: Profile;
  destinationRecs: Recommendation[] | null;
  destinationLoading: boolean;
  onRequestDestination: () => void;
  onStart: (candidate: RouteCandidate) => void;
  onClose: () => void;
};

export function SmartPanel(props: SmartPanelProps) {
  const { catalog, origin, conditions, profile } = props;
  const [mode, setMode] = useState<Mode>('choose');
  const [durationIdx, setDurationIdx] = useState(1);

  const targetDistanceKm = useMemo(() => {
    const mins = DURATIONS[durationIdx].minutes;
    return mins == null ? undefined : Math.round((profile.avgPaceKmh * mins) / 60);
  }, [durationIdx, profile.avgPaceKmh]);

  const recommendRecs = useMemo<Recommendation[]>(() => {
    if (mode !== 'recommend') return [];
    return recommendRoutes({ catalog, origin, conditions, profile, targetDistanceKm, maxResults: 3 });
  }, [mode, catalog, origin, conditions, profile, targetDistanceKm]);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      {mode === 'choose' && (
        <View style={styles.chooseRow}>
          <Pressable style={styles.choice} onPress={() => { setMode('destination'); props.onRequestDestination(); }}>
            <Text style={styles.choiceIcon}>📍</Text>
            <Text style={styles.choiceLabel}>I have a destination</Text>
          </Pressable>
          <Pressable style={[styles.choice, styles.choiceAccent]} onPress={() => setMode('recommend')}>
            <Text style={styles.choiceIcon}>✨</Text>
            <Text style={[styles.choiceLabel, styles.choiceLabelAccent]}>Recommend a route</Text>
          </Pressable>
        </View>
      )}

      {mode === 'recommend' && (
        <>
          <Text style={styles.label}>HOW LONG?</Text>
          <View style={styles.chipsRow}>
            {DURATIONS.map((d, i) => (
              <Chip key={d.label} label={d.label} active={i === durationIdx} onPress={() => setDurationIdx(i)} />
            ))}
          </View>
          <Text style={[styles.label, styles.spaced]}>FITS YOU TODAY</Text>
          <ResultList recs={recommendRecs} emptyHint={origin ? 'No matches — try a different duration.' : 'Turn on location for routes near you.'} onStart={props.onStart} />
        </>
      )}

      {mode === 'destination' && (
        <>
          <Text style={styles.label}>BEST PATH THERE</Text>
          {props.destinationLoading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Scoring routes…</Text></View>
          ) : (
            <ResultList recs={props.destinationRecs ?? []} emptyHint="Pick a destination to compare routes." onStart={props.onStart} />
          )}
        </>
      )}

      <Pressable style={styles.close} onPress={props.onClose} accessibilityRole="button">
        <Text style={styles.closeText}>{mode === 'choose' ? 'CANCEL' : 'BACK'}</Text>
      </Pressable>
    </View>
  );
}

function ResultList({ recs, emptyHint, onStart }: { recs: Recommendation[]; emptyHint: string; onStart: (c: RouteCandidate) => void }) {
  if (recs.length === 0) return <Text style={styles.emptyHint}>{emptyHint}</Text>;
  return (
    <>
      {recs.map((r, i) => <ResultCard key={r.candidate.id} rec={r} best={i === 0} onPress={() => onStart(r.candidate)} />)}
      {recs.some((r) => r.candidate.source === 'generated') && (
        <Text style={styles.genNote}>＋ generated loops near you</Text>
      )}
    </>
  );
}

function ResultCard({ rec, best, onPress }: { rec: Recommendation; best: boolean; onPress: () => void }) {
  const { candidate, fit } = rec;
  return (
    <Pressable onPress={onPress} style={[styles.card, best && styles.cardBest]} accessibilityRole="button">
      <View style={styles.miniMap}>
        <MapView
          provider={MAP_PROVIDER} style={StyleSheet.absoluteFill} customMapStyle={darkMapStyle}
          region={regionFor(candidate.coordinates)} pointerEvents="none"
          toolbarEnabled={false} showsCompass={false} showsMyLocationButton={false}
          showsPointsOfInterest={false} showsBuildings={false}
        >
          <Polyline coordinates={candidate.coordinates} strokeColor={best ? colors.primary : colors.textMuted} strokeWidth={2.5} lineCap="round" lineJoin="round" />
        </MapView>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{candidate.name.toUpperCase()}</Text>
          <Text style={[styles.cardScore, best && styles.cardScoreBest]}>{fit.score}<Text style={styles.cardScorePct}>%</Text></Text>
        </View>
        <Text style={styles.cardMeta}>{candidate.distanceKm} km · {candidate.shape}</Text>
        <View style={styles.reasons}>
          {fit.reasons.map((reason, i) => (
            <Tag key={i} icon={<View style={[styles.reasonDot, { backgroundColor: reason.good ? colors.success : colors.warning }]} />} label={reason.text} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function regionFor(coords: LatLng[]) {
  const lats = coords.map((c) => c.latitude), lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5), longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
  };
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surfaceElevated, borderRadius: radius['2xl'], padding: spacing.md,
    shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.inactiveOnDark, marginBottom: spacing.sm },
  chooseRow: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  choiceAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceIcon: { fontSize: typography.size.lg },
  choiceLabel: { color: colors.textOnDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs },
  choiceLabelAccent: { color: colors.textOnPrimary },
  label: { color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.sm },
  spaced: { marginTop: spacing.lg },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  cardBest: { borderColor: colors.primary },
  miniMap: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.black },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardName: { flex: 1, color: colors.textOnDark, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.sm },
  cardScore: { color: colors.textMuted, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.lg },
  cardScoreBest: { color: colors.primary },
  cardScorePct: { fontSize: typography.size.xs },
  cardMeta: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.xs, marginTop: spacing['3xs'], marginBottom: spacing.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonDot: { width: 8, height: 8, borderRadius: radius.pill },
  emptyHint: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.sm, textAlign: 'center', paddingVertical: spacing.md },
  genNote: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size['2xs'], textAlign: 'center', opacity: 0.7 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.xs },
  close: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  closeText: { color: colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider },
});
