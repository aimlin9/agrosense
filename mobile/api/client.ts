/**
 * Axios client for the AgroSense backend.
 *
 * The base URL comes from EXPO_PUBLIC_API_URL (or app config `extra.apiUrl`),
 * falling back to production. For local testing on a phone, set
 * EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:8000 in mobile/.env.
 */
import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';

import { getItem, removeItem, setItem } from '@/lib/storage';

const PRODUCTION_URL = 'https://agrosense-g0sb.onrender.com';

export const BASE_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  PRODUCTION_URL
).replace(/\/$/, '');

export const TOKEN_KEY = 'auth_token';

// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({
  baseURL: BASE_URL,
  // Generous: the free-tier server can take ~40s to wake from sleep.
  timeout: 45000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Token cached in memory so we don't hit SecureStore on every request.
let cachedToken: string | null | undefined;

export async function setStoredToken(token: string | null) {
  cachedToken = token;
  if (token) await setItem(TOKEN_KEY, token);
  else await removeItem(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  if (cachedToken === undefined) {
    cachedToken = await getItem(TOKEN_KEY);
  }
  return cachedToken ?? null;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Session invalidation hook ──────────────────────────────────────
// The auth store registers a handler at startup. On 401 for an
// authenticated request we notify it so it can clear state and route to
// sign-in. The indirection avoids a circular import with the store.
type InvalidationReason = 'other_device' | 'expired';
let sessionInvalidationHandler: ((reason: InvalidationReason) => void) | null = null;

export function registerSessionInvalidationHandler(handler: (reason: InvalidationReason) => void) {
  sessionInvalidationHandler = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isAuthEndpoint = /\/api\/auth\/(login|register|google|admin)/.test(url);
    if (status === 401 && !isAuthEndpoint && error.config?.headers?.Authorization) {
      const detail = error.response?.data?.detail;
      sessionInvalidationHandler?.(detail === 'session_invalidated' ? 'other_device' : 'expired');
    }
    if (__DEV__) {
      console.warn('[API]', status ?? 'network', error.config?.method?.toUpperCase(), url, error.response?.data ?? error.message);
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into one sentence a farmer can act on. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<any>;
  if (!e || typeof e !== 'object') return fallback;
  if (!('isAxiosError' in e) || !e.isAxiosError) {
    return (err as Error)?.message || fallback;
  }
  if (!e.response) {
    if (e.code === 'ECONNABORTED') {
      return 'The server is taking too long to respond. Check your connection and try again.';
    }
    return 'No internet connection. Check your data or Wi-Fi and try again.';
  }
  const { status, data } = e.response;
  const detail = data?.detail;
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc, msg, type }]
    const first = detail[0];
    const msg: string = first?.msg ?? fallback;
    return msg.replace(/^Value error, /, '');
  }
  if (typeof detail === 'string' && detail !== 'session_invalidated') return detail;
  if (status >= 500) return 'Our server had a problem. Please try again in a moment.';
  return fallback;
}

export function isNetworkError(err: unknown) {
  const e = err as AxiosError;
  return !!e?.isAxiosError && !e.response;
}

/** Fire-and-forget request that wakes the server from free-tier sleep. */
export function warmUpServer() {
  apiClient.get('/health', { timeout: 60000 }).catch(() => {});
}
