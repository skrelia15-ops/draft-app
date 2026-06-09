// lib/routes/mappers.test.ts
import { rowToCatalogRoute, type RouteRow } from './mappers';

const ROW: RouteRow = {
  id: 'coastal',
  name: 'COASTAL SLIPSTREAM',
  distance_km: 24.5,
  difficulty: 'MODERATE',
  shape: 'point-to-point',
  pace_kmh: 32,
  riders: 8,
  draft_percent: 92,
  traffic: 'MODERATE',
  note: 'Best drafting right now',
  created_at: '2026-06-09T00:00:00Z',
};

describe('rowToCatalogRoute', () => {
  it('maps snake_case columns to the camelCase domain shape', () => {
    expect(rowToCatalogRoute(ROW)).toEqual({
      id: 'coastal',
      name: 'COASTAL SLIPSTREAM',
      distanceKm: 24.5,
      difficulty: 'MODERATE',
      shape: 'point-to-point',
      paceKmh: 32,
      riders: 8,
      draftPercent: 92,
      traffic: 'MODERATE',
      note: 'Best drafting right now',
    });
  });

  it('maps a null note to undefined (so optional chaining stays clean)', () => {
    expect(rowToCatalogRoute({ ...ROW, note: null }).note).toBeUndefined();
  });
});
