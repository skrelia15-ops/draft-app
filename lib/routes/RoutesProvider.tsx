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
import { listRoutes } from './storage';
import { findRouteIn } from './helpers';
import type { CatalogRoute } from './types';

/**
 * Loads the route catalog from Supabase once at startup and exposes it to
 * Explore / RouteDetails / Groups. The catalog is small and effectively
 * static, so a single fetch + in-memory cache is enough; `refresh` is
 * provided for pull-to-refresh later.
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
    refresh().catch((e) => {
      console.warn('[RoutesProvider] initial load failed', e);
      setIsHydrated(true);
    });
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
