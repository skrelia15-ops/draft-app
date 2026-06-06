/**
 * Ride history persistence, backed by the Supabase `rides` table.
 * saveHistory upserts the full set the provider holds; loadHistory pulls
 * the signed-in user's rides newest-first. Trace downsampling is retained
 * to keep row size sane.
 */
import { supabase } from '@/lib/supabase';
import { downsample, MAX_PERSISTED_SAMPLES } from './telemetry';
import { rideToRow, rowToRide, type RideRow } from './mappers';
import type { RideRecord } from './types';

export async function loadHistory(): Promise<RideRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('rides').select('*').eq('user_id', uid).order('ended_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as RideRow[]).map(rowToRide);
}

export async function saveHistory(history: RideRecord[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  const rows = history.map((r) =>
    rideToRow({ ...r, samples: downsample(r.samples, MAX_PERSISTED_SAMPLES) }, uid),
  );
  // rideToRow returns RideRow with typed samples/segments/origin/destination
  // (RideSample[], RideSegment[], LatLng | null) which are narrower than the
  // generated Insert type's Json fields. Cast to `never` to bridge the gap.
  const { error } = await supabase.from('rides').upsert(rows as never[], { onConflict: 'id' });
  if (error && __DEV__) console.warn('[ride/storage] saveHistory failed', error);
}

export async function clearHistory(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from('rides').delete().eq('user_id', uid);
}
