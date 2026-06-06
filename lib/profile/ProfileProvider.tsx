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
 * source. The provider hydrates from AsyncStorage on mount and writes
 * back on every update; screens just call `update(partial)`.
 */

type ProfileContextValue = {
  profile: Profile;
  /** True until the first AsyncStorage read resolves. */
  isHydrated: boolean;
  update: (patch: Partial<Profile>) => Promise<Profile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      loadProfile().then((p) => {
        setProfile(p);
        setIsHydrated(true);
      });
    };
    sync();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setIsHydrated(false);
      setProfile(DEFAULT_PROFILE);
      sync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const update = useCallback(
    async (patch: Partial<Profile>): Promise<Profile> => {
      const next: Profile = {
        ...profile,
        ...patch,
        bike: patch.bike
          ? { ...(profile.bike ?? DEFAULT_PROFILE.bike!), ...patch.bike }
          : profile.bike,
        updatedAt: Date.now(),
      };
      setProfile(next);
      await saveProfile(next);
      return next;
    },
    [profile],
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
