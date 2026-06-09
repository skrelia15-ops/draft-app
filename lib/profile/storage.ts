/**
 * Profile persistence. Backed by the Supabase `profiles` table; the row
 * is auto-created by a DB trigger on sign-up, so loadProfile reads it and
 * saveProfile updates it. Signatures are unchanged from the AsyncStorage
 * version so callers don't need to change.
 */
import { supabase } from '@/lib/supabase';
import type { Json, TablesUpdate } from '@/lib/supabase/database.types';
import { rowToProfile, profileToRow, type ProfileRow } from './mappers';
import { DEFAULT_PROFILE, type Profile } from './types';

export async function loadProfile(): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return DEFAULT_PROFILE;
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', uid).single();
  if (error || !data) return { ...DEFAULT_PROFILE, id: uid };
  return rowToProfile(data as ProfileRow);
}

export async function saveProfile(profile: Profile): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    console.warn('[profile/storage] saveProfile skipped: no signed-in user');
    return false;
  }
  // Every scalar column stays type-checked against the generated Update
  // type; only the jsonb `bike` column (typed `Json` in the schema, but the
  // concrete `Bike` domain type here) needs a cast at this boundary.
  const row = profileToRow(profile);
  const payload: TablesUpdate<'profiles'> = {
    ...row,
    bike: row.bike as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profiles').update(payload).eq('id', uid);
  if (error) {
    console.warn('[profile/storage] saveProfile failed', error);
    return false;
  }
  return true;
}

/** Local-only reset used on sign-out; the cloud row stays intact. */
export async function clearProfile(): Promise<void> {
  // No-op for cloud storage: sign-out clears the session, and the next
  // user's data loads on their session. Kept for API compatibility.
}
