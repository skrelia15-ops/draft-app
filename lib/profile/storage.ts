/**
 * Profile persistence. Backed by the Supabase `profiles` table; the row
 * is auto-created by a DB trigger on sign-up, so loadProfile reads it and
 * saveProfile updates it. Signatures are unchanged from the AsyncStorage
 * version so callers don't need to change.
 */
import { supabase } from '@/lib/supabase';
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

export async function saveProfile(profile: Profile): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  // profileToRow returns ProfileUpdate (Bike | null for bike) which is
  // narrower than the generated Update type's Json | null. Cast to `never`
  // to satisfy the overloaded .update() signature while keeping our logic.
  const { error } = await supabase
    .from('profiles')
    .update({ ...profileToRow(profile), updated_at: new Date().toISOString() } as never)
    .eq('id', uid);
  if (error && __DEV__) console.warn('[profile/storage] saveProfile failed', error);
}

/** Local-only reset used on sign-out; the cloud row stays intact. */
export async function clearProfile(): Promise<void> {
  // No-op for cloud storage: sign-out clears the session, and the next
  // user's data loads on their session. Kept for API compatibility.
}
