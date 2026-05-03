import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { apiClient } from '@/api/client';

interface Farmer {
  id: string;
  phone_number: string;
  full_name: string | null;
  region: string | null;
  preferred_language: string;
}

interface AuthState {
  token: string | null;
  farmer: Farmer | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterPayload {
  phone_number: string;
  password: string;
  full_name?: string;
  region?: string;
  primary_crop?: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  farmer: null,
  isLoading: false,
  isInitialized: false,

  // Run once at app launch — load token from SecureStore
  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        set({ token });
        const response = await apiClient.get<Farmer>('/api/auth/me');
        set({ farmer: response.data });
      }
    } catch (err) {
      // Token expired or invalid — clear it
      await SecureStore.deleteItemAsync('auth_token');
      set({ token: null, farmer: null });
    } finally {
      set({ isInitialized: true });
    }
  },

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const tokenRes = await apiClient.post<{ access_token: string }>(
        '/api/auth/login',
        { phone_number: phone, password },
      );
      const token = tokenRes.data.access_token;
      await SecureStore.setItemAsync('auth_token', token);
      set({ token });

      const meRes = await apiClient.get<Farmer>('/api/auth/me');
      set({ farmer: meRes.data });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      await apiClient.post('/api/auth/register', data);
      // Auto-login after register
      await get().login(data.phone_number, data.password);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ token: null, farmer: null });
  },
}));