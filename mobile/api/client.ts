/**
 * Axios client for the AgroSense backend.
 * 
 * IMPORTANT: BASE_URL must be reachable from your phone.
 * - On the same Wi-Fi as the laptop: use http://<your-laptop-LAN-IP>:8000
 * - For ngrok testing: use the https://*.ngrok-free.dev URL
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://agrosense-g0sb.onrender.com';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request automatically
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Session invalidation hook ──────────────────────────────────────
// The auth store registers a handler here at startup. When the backend
// returns 401 with detail "session_invalidated", we call the handler so
// the store can clear local state and show a banner. This indirection
// avoids a circular import between client.ts and authStore.ts.
let sessionInvalidationHandler: (() => void) | null = null;

export function registerSessionInvalidationHandler(handler: () => void) {
  sessionInvalidationHandler = handler;
}

// Log non-2xx responses for easier debugging + handle session invalidation
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response;
      console.warn('[API]', status, config?.url, data);

      // Backend signals a stale session — kick the user out gracefully
      if (status === 401 && data?.detail === 'session_invalidated') {
        sessionInvalidationHandler?.();
      }
    } else {
      console.warn('[API] network error:', error.message, error.config?.url);
    }
    return Promise.reject(error);
  },
);