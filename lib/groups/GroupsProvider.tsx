// lib/groups/GroupsProvider.tsx
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
import {
  listMyGroups,
  listDiscoverGroups,
  listUpcomingRides,
} from './storage';
import type { Group, GroupRide } from './types';

/**
 * Holds the signed-in user's group lists and upcoming rides. Reloads when
 * the signed-in user changes (same pattern as ProfileProvider). Screens
 * call `refresh()` after a mutation (join/leave/create/schedule) to re-pull.
 */
type GroupsContextValue = {
  myGroups: Group[];
  discoverGroups: Group[];
  upcomingRides: GroupRide[];
  isHydrated: boolean;
  refresh: () => Promise<void>;
};

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<GroupRide[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const [mine, discover, rides] = await Promise.all([
      listMyGroups(),
      listDiscoverGroups(),
      listUpcomingRides(),
    ]);
    setMyGroups(mine);
    setDiscoverGroups(discover);
    setUpcomingRides(rides);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      setIsHydrated(false);
      setMyGroups([]);
      setDiscoverGroups([]);
      setUpcomingRides([]);
      if (!uid) {
        setIsHydrated(true);
        return;
      }
      refresh().catch((e) => {
        console.warn('[GroupsProvider] refresh failed', e);
        setIsHydrated(true);
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(
    () => ({ myGroups, discoverGroups, upcomingRides, isHydrated, refresh }),
    [myGroups, discoverGroups, upcomingRides, isHydrated, refresh],
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsContextValue {
  const ctx = useContext(GroupsContext);
  if (!ctx) {
    throw new Error('useGroups must be used inside <GroupsProvider>.');
  }
  return ctx;
}
