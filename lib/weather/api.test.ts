import { fetchWeather } from './api';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({
        data: {
          windKmh: 18, windDeg: 90, tempC: 15, feelsLikeC: 12,
          isRaining: false, rainMmLastHour: 0, observedAt: 1000,
        },
        error: null,
      }),
    },
  },
}));

test('fetchWeather invokes the function and returns a Weather with windFrom', async () => {
  const { supabase } = require('@/lib/supabase');
  const w = await fetchWeather({ latitude: 1, longitude: 2 });
  expect(supabase.functions.invoke).toHaveBeenCalledWith('weather', {
    body: { lat: 1, lng: 2 },
  });
  expect(w.windFrom).toBe('E');
  expect(w.tempC).toBe(15);
});

test('fetchWeather throws on edge error', async () => {
  const { supabase } = require('@/lib/supabase');
  supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
  await expect(fetchWeather({ latitude: 1, longitude: 2 })).rejects.toThrow('boom');
});
