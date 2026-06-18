import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { Bolt } from '@solar-icons/react-native/Bold';
import { MapPoint } from '@solar-icons/react-native/Linear';
import { Chip, Tag } from '@/components/ui/draft';
import { darkMapStyle, MAP_PROVIDER, type LatLng } from '@/lib/maps';
import { recommendRoutes, type Recommendation, type RouteCandidate, type Conditions } from '@/lib/ride';
import type { CatalogRoute } from '@/lib/routes';
import type { Profile } from '@/lib/profile';
import { colors, radius, spacing, typography } from '@/theme';

type Mode = 'choose' | 'recommend';
const DURATIONS: { label: string; minutes: number | null }[] = [
  { label: '30 min', minutes: 30 }, { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 }, { label: 'Any', minutes: null },
];

export type SmartPanelProps = {
  catalog: CatalogRoute[];
  origin: LatLng | null;
  conditions: Conditions;
  profile: Profile;
  /** Tapping "Destination" closes the panel and returns to the manual planner. */
  onChooseDestination: () => void;
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
          <Pressable style={styles.choice} onPress={props.onChooseDestination} accessibilityRole="button" accessibilityLabel="I have a destination">
            <MapPoint size={18} color={colors.textOnDark} />
            <Text style={styles.choiceLabel}>Destination</Text>
          </Pressable>
          <Pressable style={[styles.choice, styles.choiceAccent]} onPress={() => setMode('recommend')} accessibilityRole="button" accessibilityLabel="Recommend a route">
            <Bolt size={18} color={colors.textOnPrimary} />
            <Text style={[styles.choiceLabel, styles.choiceLabelAccent]}>Recommend</Text>
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

      <Pressable style={styles.close} onPress={mode === 'choose' ? props.onClose : () => setMode('choose')} accessibilityRole="button">
        <Text style={styles.closeText}>{mode === 'choose' ? 'CANCEL' : 'BACK'}</Text>
      </Pressable>
    </View>
  );
}

function ResultList({ recs, emptyHint, onStart }: { recs: Recommendation[]; emptyHint: string; onStart: (c: RouteCandidate) => void }) {
  if (recs.length === 0) return <Text style={styles.emptyHint}>{emptyHint}</Text>;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
      >
        {recs.map((r, i) => (
          <ResultCard key={r.candidate.id} rec={r} best={i === 0} onPress={() => onStart(r.candidate)} />
        ))}
      </ScrollView>
      {recs.some((r) => r.candidate.source === 'generated') && (
        <Text style={styles.genNote}>Generated loops near you</Text>
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
        <View style={styles.scoreBadge}>
          <Text style={[styles.scoreText, best && styles.scoreTextBest]}>{fit.score}<Text style={styles.scorePct}>%</Text></Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{candidate.name.toUpperCase()}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{candidate.distanceKm} km · {candidate.shape}</Text>
        <View style={styles.reasons}>
          {fit.reasons.slice(0, 2).map((reason) => (
            <Tag key={reason.kind} icon={<View style={[styles.reasonDot, { backgroundColor: reason.good ? colors.success : colors.warning }]} />} label={reason.text} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function regionFor(coords: LatLng[]) {
  if (coords.length === 0) return { latitude: 0, longitude: 0, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  const lats = coords.map((c) => c.latitude), lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5), longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
  };
}

const CARD_WIDTH = 196;

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surfaceElevated, borderRadius: radius['2xl'], padding: spacing.md,
    shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.inactiveOnDark, marginBottom: spacing.md },

  // Compact choose buttons — icon + label inline, pill-shaped.
  chooseRow: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.background },
  choiceAccent: { backgroundColor: colors.primary },
  choiceLabel: { color: colors.textOnDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm },
  choiceLabelAccent: { color: colors.textOnPrimary },

  label: { color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.sm },
  spaced: { marginTop: spacing.lg },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Horizontal card rail — bleeds to the sheet padding so cards scroll edge to edge.
  cardsRow: { gap: spacing.sm, paddingRight: spacing.md },
  card: { width: CARD_WIDTH, backgroundColor: colors.background, borderRadius: radius.xl, overflow: 'hidden' },
  cardBest: { borderWidth: 1, borderColor: colors.primary },
  miniMap: { width: '100%', height: 88, backgroundColor: colors.black },
  scoreBadge: { position: 'absolute', top: spacing.xs, right: spacing.xs, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.xs, paddingVertical: spacing['3xs'] },
  scoreText: { color: colors.textOnDark, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.base },
  scoreTextBest: { color: colors.primary },
  scorePct: { fontSize: typography.size['2xs'] },
  cardBody: { padding: spacing.sm },
  cardName: { color: colors.textOnDark, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.sm },
  cardMeta: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.xs, marginTop: spacing['3xs'], marginBottom: spacing.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonDot: { width: 7, height: 7, borderRadius: radius.pill },

  emptyHint: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.sm, textAlign: 'center', paddingVertical: spacing.md },
  genNote: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size['2xs'], marginTop: spacing.sm, opacity: 0.7 },
  close: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.md },
  closeText: { color: colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider },
});
