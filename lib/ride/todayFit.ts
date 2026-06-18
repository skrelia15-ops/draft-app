import type { Profile, SkillLevel } from '@/lib/profile';
import type { Conditions } from './conditions';
import { compassToBearing, type RouteCandidate } from './routeCandidate';
import type { Difficulty } from '@/lib/routes';

export type FitReason = { kind: 'wind' | 'difficulty' | 'distance' | 'weather'; good: boolean; text: string };
export type TodayFit = { score: number; tier: 'GREAT' | 'GOOD' | 'FAIR' | 'POOR'; reasons: FitReason[] };
export type FitContext = { conditions: Conditions; profile: Profile; targetDistanceKm?: number };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const DIFFICULTY_RANK: Record<Difficulty, number> = { EASY: 0, MODERATE: 1, HARD: 2 };
const SKILL_RANK: Record<SkillLevel, number> = { Novice: 0, Pro: 1, Elite: 2 };

/** Smallest absolute angle between two bearings, 0–180°. */
function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function windFactor(c: RouteCandidate, cond: Conditions): { score: number; reason: FitReason | null } {
  if (c.shape === 'loop') {
    const good = cond.draftLabel === 'OPTIMAL' || cond.draftLabel === 'GOOD';
    return {
      score: cond.draftIndex,
      reason: good ? { kind: 'wind', good: true, text: 'good drafting wind' } : null,
    };
  }
  const blowingTo = (compassToBearing(cond.windFrom) + 180) % 360;
  const diff = angularDiff(c.bearing, blowingTo);
  const align = (90 - diff) / 90;
  const score = clamp(cond.draftIndex + align * 15);
  let reason: FitReason | null = null;
  if (align > 0.4) reason = { kind: 'wind', good: true, text: 'tailwind on the way out' };
  else if (align < -0.4) reason = { kind: 'wind', good: false, text: 'headwind section' };
  return { score, reason };
}

function difficultyFactor(c: RouteCandidate, p: Profile): { score: number; reason: FitReason | null } {
  const gap = DIFFICULTY_RANK[c.difficulty] - SKILL_RANK[p.skillLevel];
  const table: Record<number, number> = { 0: 100, 1: 70, [-1]: 80, 2: 35, [-2]: 65 };
  const score = table[gap] ?? 50;
  let reason: FitReason | null = null;
  if (gap === 0) reason = { kind: 'difficulty', good: true, text: `matches your ${p.skillLevel} level` };
  else if (gap >= 1) reason = { kind: 'difficulty', good: false, text: 'a step harder than your level' };
  else reason = { kind: 'difficulty', good: true, text: 'comfortable for you' };
  return { score, reason };
}

function distanceFactor(c: RouteCandidate, target?: number): { score: number; reason: FitReason | null } {
  if (target == null || target <= 0) return { score: 70, reason: null };
  const ratio = c.distanceKm / target;
  const score = clamp(100 - Math.min(60, Math.abs(1 - ratio) * 100));
  const reason: FitReason | null = score >= 80 ? { kind: 'distance', good: true, text: 'right length for today' } : null;
  return { score, reason };
}

function weatherFactor(cond: Conditions): { score: number; reason: FitReason | null } {
  let score = 100;
  let reason: FitReason | null = null;
  if (cond.isRaining) { score = 40; reason = { kind: 'weather', good: false, text: 'rain right now' }; }
  if (cond.tempC < 2 || cond.tempC > 33) {
    score = Math.round(score * 0.6);
    if (!reason) reason = { kind: 'weather', good: false, text: cond.tempC < 2 ? 'very cold' : 'very hot' };
  }
  return { score, reason };
}

/** Score how well a candidate suits the rider right now. Pure. */
export function scoreTodayFit(candidate: RouteCandidate, ctx: FitContext): TodayFit {
  const wind = windFactor(candidate, ctx.conditions);
  const difficulty = difficultyFactor(candidate, ctx.profile);
  const distance = distanceFactor(candidate, ctx.targetDistanceKm);
  const weather = weatherFactor(ctx.conditions);

  const score = Math.round(
    wind.score * 0.4 + difficulty.score * 0.3 + distance.score * 0.2 + weather.score * 0.1,
  );
  const tier: TodayFit['tier'] = score >= 85 ? 'GREAT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : 'POOR';

  const all = [wind.reason, difficulty.reason, distance.reason, weather.reason].filter(
    (r): r is FitReason => r != null,
  );
  const reasons = [...all.filter((r) => !r.good), ...all.filter((r) => r.good)].slice(0, 3);

  return { score: clamp(score), tier, reasons };
}
