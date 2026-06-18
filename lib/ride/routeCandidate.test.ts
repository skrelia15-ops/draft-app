import { dominantBearing, compassToBearing, catalogToCandidate, loopToCandidate, directionsToCandidate } from './routeCandidate';
import type { CatalogRoute } from '@/lib/routes';

const ODESSA = { latitude: 46.4825, longitude: 30.7233 };

test('compassToBearing maps cardinal directions to degrees', () => {
  expect(compassToBearing('N')).toBe(0);
  expect(compassToBearing('E')).toBe(90);
  expect(compassToBearing('S')).toBe(180);
  expect(compassToBearing('NW')).toBe(315);
});

test('dominantBearing of a due-east leg is ~90°', () => {
  const b = dominantBearing([
    { latitude: 46.48, longitude: 30.72 },
    { latitude: 46.48, longitude: 30.80 },
  ]);
  expect(b).toBeGreaterThan(80);
  expect(b).toBeLessThan(100);
});

test('dominantBearing returns 0 for <2 points (no crash)', () => {
  expect(dominantBearing([])).toBe(0);
  expect(dominantBearing([ODESSA])).toBe(0);
});

test('catalogToCandidate carries route fields and produces coordinates', () => {
  const route: CatalogRoute = {
    id: 'r1', name: 'Seaside', distanceKm: 18, difficulty: 'MODERATE',
    shape: 'loop', paceKmh: 26, riders: 4, draftPercent: 70, traffic: 'CLEAR',
  };
  const c = catalogToCandidate(route, ODESSA);
  expect(c.id).toBe('r1');
  expect(c.name).toBe('Seaside');
  expect(c.distanceKm).toBe(18);
  expect(c.difficulty).toBe('MODERATE');
  expect(c.source).toBe('catalog');
  expect(c.coordinates.length).toBeGreaterThan(2);
});

test('loopToCandidate generates a loop candidate near origin', () => {
  const c = loopToCandidate({ origin: ODESSA, distanceKm: 12, seed: 7, difficulty: 'EASY', paceKmh: 24, id: 'gen-1', name: 'Nearby loop' });
  expect(c.source).toBe('generated');
  expect(c.shape).toBe('loop');
  expect(c.distanceKm).toBe(12);
  expect(c.coordinates.length).toBeGreaterThan(2);
  expect(c.origin).toEqual(ODESSA);
  expect(c.destination).toEqual(ODESSA);
});

test('directionsToCandidate maps a directions result, rounds distance, sets ends', () => {
  const coords = [
    { latitude: 46.48, longitude: 30.72 },
    { latitude: 46.49, longitude: 30.74 },
    { latitude: 46.50, longitude: 30.76 },
  ];
  const route = { coordinates: coords, distanceMeters: 12340 } as any;
  const c = directionsToCandidate(route, { id: 'd1', name: 'To work', difficulty: 'MODERATE', paceKmh: 28 });
  expect(c.source).toBe('directions');
  expect(c.shape).toBe('point-to-point');
  expect(c.distanceKm).toBe(12.3);
  expect(c.origin).toEqual(coords[0]);
  expect(c.destination).toEqual(coords[coords.length - 1]);
});

test('directionsToCandidate throws on empty coordinates', () => {
  const route = { coordinates: [], distanceMeters: 0 } as any;
  expect(() => directionsToCandidate(route, { id: 'x', name: 'x', difficulty: 'EASY', paceKmh: 20 })).toThrow();
});
