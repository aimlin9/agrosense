import { Feather } from '@expo/vector-icons';

export function formatCedis(value: string | number | null | undefined, digits = 2) {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? NaN;
  if (!Number.isFinite(n)) return '—';
  return `GH₵${n.toFixed(digits)}`;
}

/** "2026-10-16" (a calendar date from the API) parsed in local time, not UTC. */
export function parseLocalDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function relativeDay(isoDate: string) {
  const d = parseLocalDate(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) {
    const days = Math.floor(s / 86400);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? '';
}

export function initials(fullName: string | null | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function formatPhone(e164: string | null | undefined) {
  if (!e164) return '';
  const m = e164.match(/^\+233(\d{2})(\d{3})(\d{4})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

type IconName = keyof typeof Feather.glyphMap;

/** WMO weather codes (Open-Meteo) → short label + icon. */
export function weatherCondition(code: number | null | undefined): { label: string; icon: IconName } {
  if (code == null) return { label: '—', icon: 'cloud' };
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'cloud' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code <= 48) return { label: 'Fog', icon: 'cloud-drizzle' };
  if (code <= 57) return { label: 'Drizzle', icon: 'cloud-drizzle' };
  if (code <= 67) return { label: 'Rain', icon: 'cloud-rain' };
  if (code <= 77) return { label: 'Hail', icon: 'cloud-snow' };
  if (code <= 82) return { label: 'Showers', icon: 'cloud-rain' };
  if (code <= 99) return { label: 'Thunderstorm', icon: 'cloud-lightning' };
  return { label: '—', icon: 'cloud' };
}
