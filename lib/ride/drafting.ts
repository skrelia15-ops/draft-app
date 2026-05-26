/**
 * Drafting simulation.
 *
 * We don't have a real social/realtime layer yet — drafting status is
 * generated deterministically from the rider's current position and
 * elapsed time so the rest of the app can render *meaningful* live data
 * (instead of static fakes). The model is:
 *
 *   - Drafting alternates in 20–60 second bands.
 *   - When drafting, energy savings cluster between 18–34% (real-world
 *     range for cycling pelotons).
 *   - Solo intervals show ~0% savings.
 *
 * The seeded RNG (`mulberry32`) keeps the same point-in-time / location
 * combo deterministic — so the Insights screen and the live HUD agree.
 */

const SOLO_BASELINE_WATTS = 260;
const DRAFT_MIN_SAVE = 0.18;
const DRAFT_MAX_SAVE = 0.34;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic drafting profile for a given (rideId, elapsedSec) pair.
 * Returns whether the rider is in a draft right now + how efficient it is.
 */
export function draftingAt(
  rideId: string,
  elapsedSec: number,
): { drafting: boolean; efficiency: number } {
  const seed = hashStr(rideId);
  // 35–90 second cycles, ~55% drafting share on average.
  const periodSec = 35 + (seed % 56);
  const draftShare = 0.45 + ((seed >> 6) % 30) / 100;
  const phase = (elapsedSec / periodSec) % 1;
  const drafting = phase < draftShare;
  if (!drafting) return { drafting: false, efficiency: 0 };

  const rng = mulberry32(seed + Math.floor(elapsedSec / 8));
  const save = DRAFT_MIN_SAVE + rng() * (DRAFT_MAX_SAVE - DRAFT_MIN_SAVE);
  return { drafting: true, efficiency: Math.round(save * 100) };
}

export function soloBaselineWatts(): number {
  return SOLO_BASELINE_WATTS;
}

/**
 * Convert a draft efficiency percent (0–100) into estimated watts saved
 * vs riding solo at the same pace.
 */
export function wattsSavedFromEfficiency(efficiencyPercent: number): number {
  const fraction = Math.max(0, Math.min(1, efficiencyPercent / 100));
  return Math.round(SOLO_BASELINE_WATTS * fraction);
}
