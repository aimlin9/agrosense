import type { DailyForecast } from '@/api/types';

export type SprayRating = 'good' | 'fair' | 'poor';

/**
 * Is this a good day to spray? Rain within hours washes products off, and
 * wind causes drift. Thresholds follow common extension guidance.
 */
export function sprayRating(d: DailyForecast): { rating: SprayRating; reason: string } {
  const prob = d.precipitation_probability_pct ?? (d.precipitation_mm && d.precipitation_mm > 1 ? 70 : 10);
  const rain = d.precipitation_mm ?? 0;
  const wind = d.wind_max_kph ?? 0;
  if (prob >= 60 || rain >= 5) return { rating: 'poor', reason: 'Rain likely — spray would wash off' };
  if (wind >= 25) return { rating: 'poor', reason: 'Too windy — spray will drift' };
  if (prob >= 30 || rain >= 1) return { rating: 'fair', reason: 'Some rain risk — spray early morning' };
  if (wind >= 15) return { rating: 'fair', reason: 'Breezy — spray when wind drops' };
  return { rating: 'good', reason: 'Dry and calm — a good window' };
}

/** Typical days from planting (or transplanting) to first harvest. */
const DAYS_TO_HARVEST: Record<string, number> = {
  tomato: 75,
  maize: 100,
  'corn (maize)': 100,
  'bell pepper': 80,
  'pepper, bell': 80,
  potato: 100,
  squash: 55,
  soybean: 110,
  strawberry: 90,
};

export function suggestedHarvest(cropName: string | null | undefined, planted: Date | null): Date | null {
  if (!cropName || !planted) return null;
  const days = DAYS_TO_HARVEST[cropName.toLowerCase()];
  if (!days) return null;
  const d = new Date(planted);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDate(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysBetween(a: Date, b: Date) {
  const one = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const two = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((two - one) / 86400000);
}

/** Season progress for a plot: 0..1 plus friendly labels. */
export function seasonProgress(planting: string | null, harvest: string | null) {
  if (!planting) return null;
  const [py, pm, pd] = planting.split('-').map(Number);
  const start = new Date(py, pm - 1, pd);
  const today = new Date();
  const since = daysBetween(start, today);
  if (!harvest) return { progress: null, since, until: null };
  const [hy, hm, hd] = harvest.split('-').map(Number);
  const end = new Date(hy, hm - 1, hd);
  const total = Math.max(1, daysBetween(start, end));
  const until = daysBetween(today, end);
  return { progress: Math.max(0, Math.min(1, since / total)), since, until };
}
