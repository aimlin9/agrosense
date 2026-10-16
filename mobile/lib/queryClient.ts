import { QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

/** Single app-wide cache. Cleared on sign-in/sign-out so accounts never mix. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as AxiosError)?.response?.status;
        // Don't retry client errors; do retry network blips and 5xx (cold starts).
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 8000),
    },
    mutations: { retry: false },
  },
});
