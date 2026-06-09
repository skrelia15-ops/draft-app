/**
 * Ride history persistence, backed by the Supabase `rides` table.
 * saveRide upserts a single finished ride (scoped to the signed-in user);
 * loadHistory pulls the signed-in user's rides newest-first. Trace
 * downsampling is retained to keep row size sane.
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

/**
 * Persist a single finished ride for the signed-in user. We upsert exactly
 * the one new record — never the whole in-memory list — so a stale or
 * cross-user history array can't clobber the table or get re-stamped under
 * the wrong user_id. Returns false (and warns) if there's no live session.
 */
export async function saveRide(record: RideRecord): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    console.warn('[ride/storage] saveRide skipped: no signed-in user');
    return false;
  }
  const row = rideToRow(
    { ...record, samples: downsample(record.samples, MAX_PERSISTED_SAMPLES) },
    uid,
  );
  // rideToRow returns RideRow with typed samples/segments/origin/destination
  // (RideSample[], RideSegment[], LatLng | null) which are narrower than the
  // generated Insert type's Json fields. Cast to `never` to bridge the gap.
  const { error } = await supabase.from('rides').upsert(row as never, { onConflict: 'id' });
  if (error) {
    console.warn('[ride/storage] saveRide failed', error);
    return false;
  }
  return true;
}

export async function clearHistory(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from('rides').delete().eq('user_id', uid);
}
