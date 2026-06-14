import { normalizeOpenWeather } from './normalize';

const raw = {
  wind: { speed: 5, deg: 200 },
  main: { temp: 14.6, feels_like: 12.2 },
  weather: [{ main: 'Rain', id: 500 }],
  rain: { '1h': 1.2 },
};

test('normalizeOpenWeather converts units and flags rain', () => {
  const dto = normalizeOpenWeather(raw, 1000);
  expect(dto.windKmh).toBe(18);
  expect(dto.windDeg).toBe(200);
  expect(dto.tempC).toBe(15);
  expect(dto.feelsLikeC).toBe(12);
  expect(dto.isRaining).toBe(true);
  expect(dto.rainMmLastHour).toBe(1.2);
  expect(dto.observedAt).toBe(1000);
});

test('normalizeOpenWeather treats Clear as dry with no rain volume', () => {
  const dto = normalizeOpenWeather(
    { wind: { speed: 0, deg: 0 }, main: { temp: 20, feels_like: 20 }, weather: [{ main: 'Clear', id: 800 }] },
    2000,
  );
  expect(dto.isRaining).toBe(false);
  expect(dto.rainMmLastHour).toBe(0);
});
