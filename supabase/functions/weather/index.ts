import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizeOpenWeather } from '../../../lib/weather/normalize.ts';

const FRESH_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  // Hoisted so the outer catch can still serve a usable cached row even
  // if something after the cache read throws.
  let cached: { payload: unknown; fetched_at: string } | null = null;
  try {
    const { lat, lng } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'lat/lng required' }, 400);
    }

    const cellKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fresh cache hit?
    const { data } = await admin
      .from('weather_cache')
      .select('payload, fetched_at')
      .eq('cell_key', cellKey)
      .maybeSingle();
    cached = data ?? null;

    if (cached && isFresh(cached.fetched_at)) {
      return json(cached.payload, 200);
    }

    // 2. Fetch from OpenWeather.
    const key = Deno.env.get('OPENWEATHER_API_KEY')!;
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}&units=metric&appid=${key}`;

    let dto;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
      dto = normalizeOpenWeather(await res.json(), Date.now());
    } catch (e) {
      // 3. On failure, serve stale cache if we have any.
      if (cached) return json(cached.payload, 200);
      return json({ error: String(e) }, 502);
    }

    // 4. Upsert cache and return.
    await admin.from('weather_cache').upsert({
      cell_key: cellKey,
      payload: dto,
      fetched_at: new Date().toISOString(),
    });
    return json(dto, 200);
  } catch (e) {
    // Last resort: any usable cached row beats a hard error.
    if (cached) return json(cached.payload, 200);
    return json({ error: String(e) }, 500);
  }
});

/** True when `fetched_at` parses to a real time younger than FRESH_MS. */
function isFresh(fetchedAt: string): boolean {
  const t = new Date(fetchedAt).getTime();
  return Number.isFinite(t) && Date.now() - t < FRESH_MS;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
