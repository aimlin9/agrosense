/**
 * One location for the whole app.
 *
 * Order of preference: live GPS (if permitted) → the farm coordinates saved
 * on the profile → Accra. The result is shared across screens so we ask for
 * permission once and only take one GPS fix per session.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { useAuthStore } from '@/store/authStore';

export interface Coords {
  lat: number;
  lng: number;
}

type Source = 'gps' | 'profile' | 'default';

interface LocationState {
  coords: Coords | null;
  label: string | null;
  source: Source | null;
  permission: Location.PermissionStatus | null;
  loading: boolean;
  resolve: (opts: { ask: boolean; profile?: Coords | null; region?: string | null }) => Promise<void>;
}

const ACCRA: Coords = { lat: 5.6037, lng: -0.187 };

const useLocationStore = create<LocationState>((set, get) => ({
  coords: null,
  label: null,
  source: null,
  permission: null,
  loading: false,

  resolve: async ({ ask, profile, region }) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      let perm = (await Location.getForegroundPermissionsAsync()).status;
      if (perm !== 'granted' && ask) {
        perm = (await Location.requestForegroundPermissionsAsync()).status;
      }
      set({ permission: perm });

      if (perm === 'granted') {
        const pos =
          (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        set({ coords, source: 'gps' });
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
          const town = place?.city || place?.district || place?.subregion;
          set({ label: [town, place?.region].filter(Boolean).join(', ') || 'Your location' });
        } catch {
          set({ label: 'Your location' });
        }
        return;
      }

      if (profile) {
        set({ coords: profile, source: 'profile', label: region ? `${region} Region` : 'Your farm' });
      } else {
        set({ coords: ACCRA, source: 'default', label: 'Accra' });
      }
    } catch {
      if (!get().coords) set({ coords: profile ?? ACCRA, source: profile ? 'profile' : 'default', label: profile ? 'Your farm' : 'Accra' });
    } finally {
      set({ loading: false });
    }
  },
}));

export function useLocation({ ask = false }: { ask?: boolean } = {}) {
  const state = useLocationStore();
  const farmer = useAuthStore((s) => s.farmer);
  const profile = farmer?.gps_lat != null && farmer?.gps_lng != null ? { lat: farmer.gps_lat, lng: farmer.gps_lng } : null;

  const refresh = useCallback(
    (askNow = ask) => useLocationStore.getState().resolve({ ask: askNow, profile, region: farmer?.region }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ask, profile?.lat, profile?.lng, farmer?.region],
  );

  useEffect(() => {
    const s = useLocationStore.getState();
    // Resolve on first use, or upgrade to GPS when a screen is allowed to ask.
    if (!s.coords || (ask && s.source !== 'gps' && s.permission !== 'denied')) {
      refresh();
    }
  }, [ask, refresh]);

  return { ...state, refresh };
}
