/**
 * Axios client for the AgroSense backend.
 * 
 * IMPORTANT: BASE_URL must be reachable from your phone.
 * - On the same Wi-Fi as the laptop: use http://<your-laptop-LAN-IP>:8000
 * - For ngrok testing: use the https://*.ngrok-free.dev URL
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// CHANGE THIS to match your network setup. See instructions below.
export const BASE_URL = 'http://192.168.100.5:8000';

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

// Log non-2xx responses for easier debugging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.warn('[API]', error.response.status, error.config?.url, error.response.data);
    } else {
      console.warn('[API] network error:', error.message, error.config?.url);
    }
    return Promise.reject(error);
  },
);