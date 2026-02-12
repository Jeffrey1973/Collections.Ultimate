import { useAuth } from '../context/AuthContext';
import { useCallback } from 'react';

/**
 * Returns a `fetchWithAuth` function that automatically attaches
 * the Bearer token when the user is authenticated.
 *
 * Usage:
 *   const fetchWithAuth = useAuthFetch();
 *   const res = await fetchWithAuth('/api/items/123');
 */
export function useAuthFetch() {
  const { getAccessToken, isAuthenticated } = useAuth();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);

      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }

      return fetch(input, { ...init, headers });
    },
    [getAccessToken, isAuthenticated]
  );
}
