/**
 * Ride history persistence, backed by the Supabase `rides` table.
 * saveRide upserts a single finished ride (scoped to the signed-in user);
 * loadHistory pulls the signed-in user's rides newest-first. Trace
 * downsampling is retained to keep row size sane.
 */
import { supabase } from '@/lib/supabase';
import type { Json, TablesInsert } from '@/lib/supabase/database.types';
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
  // Every scalar column stays type-checked against the generated Insert
  // type; only the jsonb columns (typed `Json` in the schema, but concrete
  // domain types here) need a cast at this serialization boundary.
  const insert: TablesInsert<'rides'> = {
    ...row,
    samples: row.samples as unknown as Json,
    segments: row.segments as unknown as Json,
    origin: row.origin as unknown as Json,
    destination: row.destination as unknown as Json,
  };
  const { error } = await supabase.from('rides').upsert(insert, { onConflict: 'id' });
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
