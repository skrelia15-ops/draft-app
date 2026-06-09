// lib/routes/RoutesProvider.tsx
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
import { listRoutes } from './storage';
import { findRouteIn } from './helpers';
import type { CatalogRoute } from './types';

/**
 * Loads the route catalog from Supabase and exposes it to
 * Explore / RouteDetails / Groups.
 *
 * The catalog is readable only by authenticated users (RLS), so we must wait
 * for the session to be restored before fetching — otherwise the first
 * request goes out as anon and RLS returns []. We therefore load in response
 * to `onAuthStateChange` (same pattern as GroupsProvider) rather than a
 * one-shot mount fetch. `refresh` stays exposed for pull-to-refresh.
 */
type RoutesContextValue = {
  routes: CatalogRoute[];
  isHydrated: boolean;
  findRoute: (id: string | undefined) => CatalogRoute | undefined;
  refresh: () => Promise<void>;
};

const RoutesContext = createContext<RoutesContextValue | null>(null);

export function RoutesProvider({ children }: { children: ReactNode }) {
  const [routes, setRoutes] = useState<CatalogRoute[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listRoutes();
    setRoutes(list);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      if (!uid) {
        setRoutes([]);
        setIsHydrated(true);
        return;
      }
      setIsHydrated(false);
      refresh().catch((e) => {
        console.warn('[RoutesProvider] load failed', e);
        setIsHydrated(true);
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const findRoute = useCallback(
    (id: string | undefined) => findRouteIn(routes, id),
    [routes],
  );

  const value = useMemo(
    () => ({ routes, isHydrated, findRoute, refresh }),
    [routes, isHydrated, findRoute, refresh],
  );

  return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
}

export function useRoutes(): RoutesContextValue {
  const ctx = useContext(RoutesContext);
  if (!ctx) {
    throw new Error('useRoutes must be used inside <RoutesProvider>.');
  }
  return ctx;
}
