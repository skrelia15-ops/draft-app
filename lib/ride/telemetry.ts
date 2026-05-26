/**
 * Pure math + formatting helpers used by ride telemetry.
 * No React, no async. Trivially unit-testable.
 */
import type { LatLng } from '@/lib/maps';

const EARTH_RADIUS_M = 6_371_000;

/** Distance in meters between two LatLng points (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/** "24:12" — minutes and seconds, with leading-zero seconds. */
export function formatMmSs(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "1H 24M" / "24M" — for ride duration shown in summaries. */
export function formatHourMin(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h <= 0) return `${m}M`;
  return `${h}H ${m}M`;
}

/** "24.5 KM" or "320 M". */
export function formatDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 M';
  if (meters < 1000) return `${Math.round(meters)} M`;
  return `${(meters / 1000).toFixed(1)} KM`;
}

/** "25.4 KMH" — one decimal for speed display. */
export function formatKmh(kmh: number): string {
  return `${kmh.toFixed(1)} KMH`;
}

/** Generate a short, stable id (good enough for client-side records). */
export function shortId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reasonable cap on samples saved per ride. 1 sample / sec for 4 hours
 * is still only 14400 — but we keep storage tight by sub-sampling longer
 * rides on save.
 */
export const MAX_PERSISTED_SAMPLES = 1500;

/** Down-sample an array of samples to at most `max` entries (even spacing). */
export function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const stride = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(items[Math.floor(i * stride)]);
  }
  return out;
}
