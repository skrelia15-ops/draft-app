import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

const BUCKET = 'avatars';

/**
 * Uploads a local image URI to the signed-in user's avatars folder and
 * returns the storage object path (e.g. `<uid>/avatar.jpg`), or null on
 * failure.
 *
 * Why base64 + base64-arraybuffer instead of `fetch(uri).arrayBuffer()`:
 * the fetch/Blob path is unreliable in React Native and frequently yields
 * a 0-byte upload. Reading the file as base64 via expo-file-system and
 * decoding to an ArrayBuffer is the proven-reliable pattern. We use the
 * `expo-file-system/legacy` entry because SDK 54 moved `readAsStringAsync`
 * there (the new `File` API is the non-legacy default).
 */
export async function uploadAvatar(localUri: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const path = `${uid}/avatar.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) {
      if (__DEV__) console.warn('[avatar] upload failed', error);
      return null;
    }
    return path;
  } catch (err) {
    if (__DEV__) console.warn('[avatar] upload failed', err);
    return null;
  }
}

/** Resolves a storage path to a temporary signed URL for display, or null. */
export async function avatarSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Classifies an avatar value: a `file://`, `http://`, or `https://` value
 * is a directly-renderable URI; any other non-null value is treated as a
 * Storage object path that must be resolved to a signed URL.
 */
export function isDirectUri(value: string): boolean {
  return (
    value.startsWith('file://') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}
