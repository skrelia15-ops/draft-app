import type { CompassDirection } from '@/lib/ride';
import type { WeatherDTO } from './types';

/** Client-side view of weather: DTO plus the 8-point compass label. */
export type Weather = WeatherDTO & { windFrom: CompassDirection };

const SECTORS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Degrees (0–360, wind coming FROM) → nearest 8-point compass label. */
export function windFromDeg(deg: number): CompassDirection {
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return SECTORS[idx];
}

export function toWeather(dto: WeatherDTO): Weather {
  return { ...dto, windFrom: windFromDeg(dto.windDeg) };
}
