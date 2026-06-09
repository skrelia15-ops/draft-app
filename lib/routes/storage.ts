// lib/routes/storage.ts
import { supabase } from '@/lib/supabase';
import { rowToCatalogRoute, type RouteRow } from './mappers';
import type { CatalogRoute } from './types';

/** Load the full route catalog, sorted by drafting potential (the default
 *  Explore ordering). Returns [] on error so the UI shows an empty state
 *  rather than crashing. */
export async function listRoutes(): Promise<CatalogRoute[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('draft_percent', { ascending: false });
  if (error || !data) {
    console.warn('[routes/storage] listRoutes failed', error);
    return [];
  }
  return (data as RouteRow[]).map(rowToCatalogRoute);
}
