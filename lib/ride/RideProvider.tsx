import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import type { LatLng } from '@/lib/maps';
import { draftingAt } from './drafting';
import { liveWattsSaved, summarizeRide } from './insights';
import { loadHistory, saveHistory } from './storage';
import {
  haversineMeters,
  msToKmh,
  shortId,
} from './telemetry';
import type {
  RidePhase,
  RideLiveStats,
  RideRecord,
  RideSample,
} from './types';

/**
 * Centralised ride state.
 *
 * Owns:
 *   - the phase machine (idle → active → paused → finished)
 *   - the in-flight GPS sample buffer
 *   - live derived stats (speed, distance, ETA, draft efficiency)
 *   - persistence into Supabase
 *
 * Designed so the Map → Active → Complete → Insights screens can all
 * pull from a single source of truth without each screen having to be
 * told what the last screen knew.
 */

type StartArgs = {
  routeName?: string;
  routeCoordinates?: LatLng[];
  routeDistanceMeters?: number;
  origin?: LatLng;
  destination?: LatLng;
  /** Rider's typical pace, used as ETA fallback when GPS speed is 0. */
  fallbackPaceKmh?: number;
};

type RideContextValue = {
  phase: RidePhase;
  liveStats: RideLiveStats;
  history: RideRecord[];
  /** Most recently finished ride (cleared when explicitly dismissed). */
  lastFinished: RideRecord | null;
  routeName: string | null;
  routeCoordinates: LatLng[];
  destination: LatLng | null;
  startRide: (args?: StartArgs) => void;
  pauseRide: () => void;
  resumeRide: () => void;
  finishRide: () => RideRecord | null;
  discardRide: () => void;
  acknowledgeFinished: () => void;
};

const EMPTY_LIVE: RideLiveStats = {
  elapsedSec: 0,
  speedKmh: 0,
  distanceMeters: 0,
  remainingMeters: null,
  etaSec: null,
  draftEfficiencyPercent: 0,
  drafting: false,
  wattsSavedNow: 0,
  avgSpeedKmh: 0,
};

const RideContext = createContext<RideContextValue | null>(null);

// How many GPS samples to keep in the rolling average for smoothed
// current speed. Larger = smoother but laggy; smaller = jumpier.
const RECENT_WINDOW_SAMPLES = 6;

// Speed (m/s) below which the rider is treated as stationary — i.e.
// drafting, energy savings, and ETA fall back to zero/inert. 1.0 m/s ≈
// 3.6 km/h, slow walking pace. Anything slower is GPS noise or a stop.
const MOVING_THRESHOLD_MS = 1;

export function RideProvider({ children }: { children: ReactNode }) {  const [phase, setPhase] = useState<RidePhase>('idle');
  const [liveStats, setLiveStats] = useState<RideLiveStats>(EMPTY_LIVE);
  const [history, setHistory] = useState<RideRecord[]>([]);
  const [lastFinished, setLastFinished] = useState<RideRecord | null>(null);
  const [routeName, setRouteName] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [destination, setDestination] = useState<LatLng | null>(null);

  // ── Mutable, render-stable refs.
  const rideIdRef = useRef<string | null>(null);
  const samplesRef = useRef<RideSample[]>([]);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const pausedTotalMsRef = useRef<number>(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentSpeedsRef = useRef<number[]>([]);
  const routeDistanceRef = useRef<number | null>(null);
  const originRef = useRef<LatLng | null>(null);
  const destRef = useRef<LatLng | null>(null);
  const routeNameRef = useRef<string | null>(null);
  const fallbackPaceKmhRef = useRef<number>(28);

  // Load the signed-in user's history. onAuthStateChange fires
  // INITIAL_SESSION on subscribe (initial load) and again on sign in/out;
  // only reload when the user actually changes so token refreshes don't
  // trigger redundant fetches.
  useEffect(() => {
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      loadHistory().then(setHistory);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────

  const activeElapsedMs = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const now = Date.now();
    const paused = pausedAtRef.current ? now - pausedAtRef.current : 0;
    return now - startedAtRef.current - pausedTotalMsRef.current - paused;
  }, []);

  const pushSample = useCallback(
    (latitude: number, longitude: number, speedMs: number) => {
      const rideId = rideIdRef.current;
      if (!rideId) return;
      const elapsedMs = activeElapsedMs();
      const elapsedSec = Math.max(0, elapsedMs / 1000);
      // Only consider the rider "drafting" if they're actually moving —
      // the synthetic drafting model is time-based, so without a motion
      // gate a stationary rider would accumulate fake drafting time and
      // fake energy savings.
      const isMoving = speedMs > MOVING_THRESHOLD_MS;
      const { drafting } = isMoving
        ? draftingAt(rideId, elapsedSec)
        : { drafting: false };
      const sample: RideSample = {
        t: elapsedMs,
        capturedAt: Date.now(),
        latitude,
        longitude,
        speedMs: Math.max(0, speedMs),
        drafting,
      };
      samplesRef.current.push(sample);

      // Maintain a tiny rolling window for smoothed speed.
      recentSpeedsRef.current.push(speedMs);
      if (recentSpeedsRef.current.length > RECENT_WINDOW_SAMPLES) {
        recentSpeedsRef.current.shift();
      }
    },
    [activeElapsedMs],
  );

  const recomputeLive = useCallback(() => {
    const rideId = rideIdRef.current;
    if (!rideId) return;
    const samples = samplesRef.current;
    const elapsedSec = Math.max(0, activeElapsedMs() / 1000);

    let distanceMeters = 0;
    let speedSum = 0;
    let speedCount = 0;
    for (let i = 1; i < samples.length; i++) {
      distanceMeters += haversineMeters(samples[i - 1], samples[i]);
    }
    for (const s of samples) {
      if (s.speedMs > 0) {
        speedSum += s.speedMs;
        speedCount += 1;
      }
    }

    // Smoothed current speed prefers the device's reported speed (rolling
    // mean of the last few samples); if that's unavailable we fall back
    // to the most recent point-to-point delta.
    const recent = recentSpeedsRef.current.filter((s) => s > 0);
    let smoothedMs = recent.length
      ? recent.reduce((a, b) => a + b, 0) / recent.length
      : 0;
    if (smoothedMs === 0 && samples.length >= 2) {
      const a = samples[samples.length - 2];
      const b = samples[samples.length - 1];
      const dtSec = Math.max(0.001, (b.t - a.t) / 1000);
      smoothedMs = haversineMeters(a, b) / dtSec;
    }
    const speedKmh = msToKmh(smoothedMs);
    const avgSpeedKmh =
      speedCount > 0
        ? msToKmh(speedSum / speedCount)
        : elapsedSec > 0
          ? (distanceMeters / elapsedSec) * 3.6
          : 0;

    // Drafting + energy savings require actual motion. Without this
    // gate the time-based `draftingAt` model would report drafting +
    // watts saved while the rider sits still waiting for GPS lock.
    const isMoving = smoothedMs > MOVING_THRESHOLD_MS;
    const { drafting, efficiency } = isMoving
      ? draftingAt(rideId, elapsedSec)
      : { drafting: false, efficiency: 0 };
    const wattsSavedNow = isMoving ? liveWattsSaved(efficiency) : 0;

    let remainingMeters: number | null = null;
    let etaSec: number | null = null;
    if (routeDistanceRef.current != null) {
      remainingMeters = Math.max(0, routeDistanceRef.current - distanceMeters);
      const speedForEta = isMoving
        ? smoothedMs
        : fallbackPaceKmhRef.current / 3.6;
      etaSec = remainingMeters / speedForEta;
    } else if (destRef.current && samples.length > 0) {
      const last = samples[samples.length - 1];
      remainingMeters = haversineMeters(
        { latitude: last.latitude, longitude: last.longitude },
        destRef.current,
      );
      const speedForEta = isMoving
        ? smoothedMs
        : fallbackPaceKmhRef.current / 3.6;
      etaSec = remainingMeters / speedForEta;
    }
    // Cap absurd ETAs (no GPS / no motion / huge distance) so we don't
    // render "42 days to go" in the UI.
    if (etaSec != null && etaSec > 12 * 60 * 60) {
      etaSec = null;
    }

    setLiveStats({
      elapsedSec,
      speedKmh,
      distanceMeters,
      remainingMeters,
      etaSec,
      draftEfficiencyPercent: efficiency,
      drafting,
      wattsSavedNow,
      avgSpeedKmh,
    });
  }, [activeElapsedMs]);

  // ── Subscription lifecycle ────────────────────────────────────────────

  const stopSubscription = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startSubscription = useCallback(async () => {
    stopSubscription();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000,
        },
        (loc) => {
          if (!rideIdRef.current) return;
          if (pausedAtRef.current) return;
          pushSample(
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed : 0,
          );
          recomputeLive();
        },
      );
    } catch (e) {
      if (__DEV__) console.warn('[RideProvider] watchPositionAsync failed', e);
    }
  }, [pushSample, recomputeLive, stopSubscription]);

  const startTick = useCallback(() => {
    stopTick();
    tickRef.current = setInterval(() => {
      if (!rideIdRef.current || pausedAtRef.current) return;
      recomputeLive();
    }, 1000);
  }, [recomputeLive, stopTick]);

  // ── Public API ────────────────────────────────────────────────────────

  const startRide = useCallback(
    (args: StartArgs = {}) => {
      const id = shortId();
      rideIdRef.current = id;
      samplesRef.current = [];
      startedAtRef.current = Date.now();
      pausedAtRef.current = null;
      pausedTotalMsRef.current = 0;
      recentSpeedsRef.current = [];
      routeDistanceRef.current = args.routeDistanceMeters ?? null;
      destRef.current = args.destination ?? null;
      originRef.current = args.origin ?? null;
      routeNameRef.current = args.routeName ?? null;
      fallbackPaceKmhRef.current = args.fallbackPaceKmh ?? 28;

      setRouteName(args.routeName ?? null);
      setRouteCoordinates(args.routeCoordinates ?? []);
      setDestination(args.destination ?? null);
      setLiveStats(EMPTY_LIVE);
      setLastFinished(null);
      setPhase('active');

      startSubscription();
      startTick();
    },
    [startSubscription, startTick],
  );

  const pauseRide = useCallback(() => {
    if (phase !== 'active') return;
    pausedAtRef.current = Date.now();
    stopSubscription();
    setPhase('paused');
    recomputeLive();
  }, [phase, recomputeLive, stopSubscription]);

  const resumeRide = useCallback(() => {
    if (phase !== 'paused') return;
    if (pausedAtRef.current) {
      pausedTotalMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    setPhase('active');
    startSubscription();
    recomputeLive();
  }, [phase, recomputeLive, startSubscription]);

  const finishRide = useCallback((): RideRecord | null => {
    if (phase === 'idle' || phase === 'finished') return null;
    if (pausedAtRef.current) {
      pausedTotalMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    const id = rideIdRef.current;
    if (!id) return null;
    const endedAt = Date.now();
    const durationSec = Math.max(
      0,
      (endedAt - startedAtRef.current - pausedTotalMsRef.current) / 1000,
    );
    const record = summarizeRide({
      id,
      startedAt: startedAtRef.current,
      endedAt,
      durationSec,
      samples: samplesRef.current,
      routeName: routeNameRef.current ?? undefined,
      origin: originRef.current ?? undefined,
      destination: destRef.current ?? undefined,
    });

    stopSubscription();
    stopTick();
    rideIdRef.current = null;
    samplesRef.current = [];

    setPhase('finished');
    setLastFinished(record);
    setHistory((prev) => {
      const next = [record, ...prev];
      saveHistory(next);
      return next;
    });
    return record;
  }, [phase, stopSubscription, stopTick]);

  const discardRide = useCallback(() => {
    stopSubscription();
    stopTick();
    rideIdRef.current = null;
    samplesRef.current = [];
    startedAtRef.current = 0;
    pausedAtRef.current = null;
    pausedTotalMsRef.current = 0;
    setPhase('idle');
    setLiveStats(EMPTY_LIVE);
    setLastFinished(null);
  }, [stopSubscription, stopTick]);

  const acknowledgeFinished = useCallback(() => {
    setPhase('idle');
    setLiveStats(EMPTY_LIVE);
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopSubscription();
      stopTick();
    };
  }, [stopSubscription, stopTick]);

  const value = useMemo<RideContextValue>(
    () => ({
      phase,
      liveStats,
      history,
      lastFinished,
      routeName,
      routeCoordinates,
      destination,
      startRide,
      pauseRide,
      resumeRide,
      finishRide,
      discardRide,
      acknowledgeFinished,
    }),
    [
      phase,
      liveStats,
      history,
      lastFinished,
      routeName,
      routeCoordinates,
      destination,
      startRide,
      pauseRide,
      resumeRide,
      finishRide,
      discardRide,
      acknowledgeFinished,
    ],
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide(): RideContextValue {
  const ctx = useContext(RideContext);
  if (!ctx) {    throw new Error('useRide must be used inside <RideProvider>.');
  }
  return ctx;
}
