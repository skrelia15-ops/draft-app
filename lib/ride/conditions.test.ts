import { deriveConditions } from './conditions';
import type { Weather } from '@/lib/weather/derive';

function weather(partial: Partial<Weather>): Weather {
  return {
    windKmh: 10, windDeg: 0, windFrom: 'N', tempC: 18, feelsLikeC: 17,
    isRaining: false, rainMmLastHour: 0, observedAt: 0, ...partial,
  };
}

test('light wind (<8) is FAIR', () => {
  const c = deriveConditions(weather({ windKmh: 5 }));
  expect(c.draftIndex).toBe(62);
  expect(c.draftLabel).toBe('FAIR');
});

test('ideal wind (8–13) is OPTIMAL', () => {
  const c = deriveConditions(weather({ windKmh: 12 }));
  expect(c.draftIndex).toBe(92);
  expect(c.draftLabel).toBe('OPTIMAL');
});

test('strong wind (>=20) is FAIR (index 60)', () => {
  const c = deriveConditions(weather({ windKmh: 25 }));
  expect(c.draftIndex).toBe(60);
  expect(c.draftLabel).toBe('FAIR');
});

test('passes weather fields through', () => {
  const c = deriveConditions(weather({ tempC: 21, feelsLikeC: 19, isRaining: true, rainMmLastHour: 1.2 }));
  expect(c.tempC).toBe(21);
  expect(c.feelsLikeC).toBe(19);
  expect(c.isRaining).toBe(true);
  expect(c.rainMmLastHour).toBe(1.2);
});
