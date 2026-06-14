import { windFromDeg, toWeather } from './derive';
import type { WeatherDTO } from './types';

test('windFromDeg maps the 8 compass sectors', () => {
  expect(windFromDeg(0)).toBe('N');
  expect(windFromDeg(45)).toBe('NE');
  expect(windFromDeg(90)).toBe('E');
  expect(windFromDeg(180)).toBe('S');
  expect(windFromDeg(315)).toBe('NW');
  expect(windFromDeg(350)).toBe('N');
});

test('toWeather adds windFrom derived from windDeg', () => {
  const dto: WeatherDTO = {
    windKmh: 18, windDeg: 90, tempC: 15, feelsLikeC: 12,
    isRaining: false, rainMmLastHour: 0, observedAt: 1000,
  };
  expect(toWeather(dto)).toEqual({ ...dto, windFrom: 'E' });
});
