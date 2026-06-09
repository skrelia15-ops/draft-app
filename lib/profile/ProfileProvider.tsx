import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { loadProfile, saveProfile } from './storage';
import { DEFAULT_PROFILE, type Profile } from './types';

/**
 * Wraps the profile in a tiny store so every screen pulls from the same
 * source. The provider loads the signed-in user's profile from Supabase
 * and reloads it whenever the signed-in user changes; screens just call
 * `update(partial)`.
 */

type ProfileContextValue = {
  profile: Profile;
  /** True once the profile for the current session has loaded. */
  isHydrated: boolean;
  update: (patch: Partial<Profile>) => Promise<Profile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on subscribe (initial load),
    // then on SIGNED_IN/OUT and token refreshes. Only reload when the
    // signed-in user actually changes, so an hourly token refresh doesn't
    // blank the in-memory profile mid-session.
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      setIsHydrated(false);
      setProfile(DEFAULT_PROFILE);
      loadProfile()
        .then((p) => {
          setProfile(p);
          setIsHydrated(true);
        })
        .catch((e) => {
          // Don't strand the app on the splash if the load rejects (offline,
          // Supabase down). Mark hydrated so the nav gate can proceed; the
          // user falls back to DEFAULT_PROFILE and can retry by reloading.
          console.warn('[ProfileProvider] loadProfile failed', e);
          setIsHydrated(true);
        });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const update = useCallback(
    async (patch: Partial<Profile>): Promise<Profile> => {
      // Derive the next profile from the freshest state via the functional
      // updater, so two rapid update() calls (e.g. an avatar upload landing
      // while the user edits their name) don't both read the same stale
      // `profile` and clobber each other (last-write-wins data loss).
      let next!: Profile;
      setProfile((current) => {
        next = {
          ...current,
          ...patch,
          bike: patch.bike
            ? { ...(current.bike ?? DEFAULT_PROFILE.bike!), ...patch.bike }
            : current.bike,
          updatedAt: Date.now(),
        };
        return next;
      });
      await saveProfile(next);
      return next;
    },
    [],
  );

  const value = useMemo(
    () => ({ profile, isHydrated, update }),
    [profile, isHydrated, update],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used inside <ProfileProvider>.');
  }
  return ctx;
}
