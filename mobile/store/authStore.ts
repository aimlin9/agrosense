import { create } from 'zustand';

import {
  apiClient,
  getStoredToken,
  isNetworkError,
  registerSessionInvalidationHandler,
  setStoredToken,
} from '@/api/client';
import type { Farmer } from '@/api/types';
import { queryClient } from '@/lib/queryClient';
import { getItem, removeItem, setItem } from '@/lib/storage';
import { signInWithGoogle, signOutGoogle } from '@/services/googleAuth';

const ONBOARDING_KEY = 'onboarding_seen';
const FARMER_CACHE_KEY = 'farmer_cache';

export interface RegisterPayload {
  phone_number: string;
  password: string;
  full_name?: string;
  region?: string;
  primary_crop?: string;
}

type Notice = { title: string; message: string } | null;

interface AuthState {
  token: string | null;
  farmer: Farmer | null;
  isInitialized: boolean;
  hasSeenOnboarding: boolean;
  /** One-off message shown on the sign-in screen (e.g. signed out elsewhere). */
  notice: Notice;

  initialize: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  loginWithGoogle: () => Promise<{ profileComplete: boolean }>;
  refreshFarmer: () => Promise<Farmer | null>;
  setFarmer: (farmer: Farmer) => void;
  setToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: (notice?: Notice) => Promise<void>;
  clearNotice: () => void;
  markOnboardingSeen: () => Promise<void>;
}

async function cacheFarmer(farmer: Farmer | null) {
  if (farmer) await setItem(FARMER_CACHE_KEY, JSON.stringify(farmer));
  else await removeItem(FARMER_CACHE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  farmer: null,
  isInitialized: false,
  hasSeenOnboarding: false,
  notice: null,

  // Runs once at launch. Uses the cached profile so the app opens instantly
  // (and offline), then refreshes it from the server in the background.
  initialize: async () => {
    try {
      const [token, seen, cached] = await Promise.all([
        getStoredToken(),
        getItem(ONBOARDING_KEY),
        getItem(FARMER_CACHE_KEY),
      ]);
      set({ hasSeenOnboarding: seen === '1' });
      if (!token) return;

      const cachedFarmer: Farmer | null = cached ? JSON.parse(cached) : null;
      if (cachedFarmer) {
        set({ token, farmer: cachedFarmer });
        get().refreshFarmer().catch(() => {});
        return;
      }
      set({ token });
      const res = await apiClient.get<Farmer>('/api/auth/me');
      set({ farmer: res.data });
      cacheFarmer(res.data);
    } catch (err) {
      // Offline with no cached profile: keep the token, the user can retry.
      if (!isNetworkError(err)) {
        await setStoredToken(null);
        set({ token: null, farmer: null });
      }
    } finally {
      set({ isInitialized: true });
    }
  },

  setToken: async (token) => {
    await setStoredToken(token);
    set({ token });
  },

  setFarmer: (farmer) => {
    set({ farmer });
    cacheFarmer(farmer);
  },

  refreshFarmer: async () => {
    const res = await apiClient.get<Farmer>('/api/auth/me');
    get().setFarmer(res.data);
    return res.data;
  },

  login: async (phone, password) => {
    const res = await apiClient.post<{ access_token: string }>('/api/auth/login', {
      phone_number: phone,
      password,
    });
    queryClient.clear();
    await get().setToken(res.data.access_token);
    await get().refreshFarmer();
    set({ notice: null });
  },

  register: async (data) => {
    await apiClient.post('/api/auth/register', data);
    await get().login(data.phone_number, data.password);
  },

  loginWithGoogle: async () => {
    const result = await signInWithGoogle();
    queryClient.clear();
    await get().setToken(result.accessToken);
    await get().refreshFarmer();
    set({ notice: null });
    return { profileComplete: result.profileComplete };
  },

  logout: async () => {
    // Revoke server-side so the token can't be reused; don't block on it.
    apiClient.post('/api/auth/logout', null, { timeout: 8000 }).catch(() => {});
    await signOutGoogle();
    await get().clearSession();
  },

  clearSession: async (notice = null) => {
    await setStoredToken(null);
    await cacheFarmer(null);
    queryClient.clear();
    set({ token: null, farmer: null, notice });
  },

  clearNotice: () => set({ notice: null }),

  markOnboardingSeen: async () => {
    await setItem(ONBOARDING_KEY, '1');
    set({ hasSeenOnboarding: true });
  },
}));

registerSessionInvalidationHandler((reason) => {
  if (!useAuthStore.getState().token) return;
  useAuthStore.getState().clearSession(
    reason === 'other_device'
      ? {
          title: 'Signed out',
          message: 'Your account was signed in on another device. Sign in again to continue here.',
        }
      : { title: 'Session expired', message: 'Please sign in again to continue.' },
  );
});
