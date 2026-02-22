import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthHousehold {
  id: string;
  role: string;
}

interface AuthUser {
  accountId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  households: AuthHousehold[];
}

interface AuthContextValue {
  /** Current authenticated user (null if not logged in) */
  user: AuthUser | null;
  /** True while checking auth state */
  isLoading: boolean;
  /** True if Auth0 is configured and user is authenticated */
  isAuthenticated: boolean;
  /** True if user needs to complete their profile (no first/last name) */
  needsProfileCompletion: boolean;
  /** Update user profile after completing profile form */
  updateUserProfile: (firstName: string, lastName: string, displayName: string) => void;
  /** Trigger Auth0 login redirect */
  login: () => void;
  /** Trigger Auth0 signup redirect (opens registration screen) */
  signup: () => void;
  /** Trigger Auth0 logout */
  logout: () => void;
  /** Get a valid access token for API calls */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  needsProfileCompletion: false,
  updateUserProfile: () => {},
  login: () => {},
  signup: () => {},
  logout: () => {},
  getAccessToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

// ── Auth0 config from env ──────────────────────────────────────────────────────

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || '';
const AUTH0_ENABLED = !!(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

// We'll lazy-load the Auth0 SPA SDK to avoid bundling it when auth isn't configured
let auth0Client: any = null;

async function getAuth0Client() {
  if (auth0Client) return auth0Client;
  if (!AUTH0_ENABLED) return null;

  const { Auth0Client } = await import('@auth0/auth0-spa-js');
  auth0Client = new Auth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: AUTH0_AUDIENCE,
      scope: 'openid profile email',
    },
    cacheLocation: 'localstorage',
  });
  return auth0Client;
}

// ── Provider ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5259';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: handle redirect callback + check existing session
  useEffect(() => {
    if (!AUTH0_ENABLED) {
      setIsLoading(false);
      return;
    }

    // Guard against StrictMode double-invocation
    let cancelled = false;

    const init = async () => {
      try {
        const client = await getAuth0Client();
        if (!client || cancelled) { setIsLoading(false); return; }

        // Log the full URL to debug Auth0 redirects
        console.log('[Auth] Current URL:', window.location.href);

        // Handle Auth0 error responses
        const params = new URLSearchParams(window.location.search);
        if (params.has('error')) {
          console.error('[Auth] Auth0 error:', params.get('error'));
          console.error('[Auth] Error description:', params.get('error_description'));
          window.history.replaceState({}, '', window.location.pathname);
        }

        // Handle redirect callback (only if code+state are still in the URL)
        if (params.has('code') && params.has('state')) {
          console.log('[Auth] Handling redirect callback...');
          try {
            await client.handleRedirectCallback();
            console.log('[Auth] Redirect callback handled');
          } catch (cbErr: any) {
            // "Invalid state" means the callback was already processed (StrictMode re-run)
            console.warn('[Auth] handleRedirectCallback error (may be StrictMode re-run):', cbErr.message);
          }
          // Always clear the URL params so we don't try again
          window.history.replaceState({}, '', window.location.pathname);
        }

        if (cancelled) return;

        const isAuth = await client.isAuthenticated();
        console.log('[Auth] isAuthenticated:', isAuth);
        if (isAuth) {
          const token = await client.getTokenSilently();
          console.log('[Auth] Got token, calling /api/auth/login...');
          // Call our login endpoint to sync account
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          console.log('[Auth] /api/auth/login response:', res.status, res.statusText);
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            console.log('[Auth] Login success:', data);
            setUser({
              accountId: data.accountId,
              displayName: data.displayName,
              firstName: data.firstName ?? null,
              lastName: data.lastName ?? null,
              email: data.email,
              households: data.households,
            });
          } else {
            const text = await res.text();
            console.error('[Auth] Login failed:', res.status, text);
          }
        }
      } catch (err) {
        console.error('[Auth] Auth init error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    console.log('[Auth] login() called, AUTH0_ENABLED:', AUTH0_ENABLED);
    console.log('[Auth] AUTH0_DOMAIN:', AUTH0_DOMAIN);
    console.log('[Auth] AUTH0_CLIENT_ID:', AUTH0_CLIENT_ID);
    try {
      const client = await getAuth0Client();
      console.log('[Auth] login() got client:', !!client);
      if (client) {
        await client.loginWithRedirect();
      } else {
        console.warn('[Auth] No client returned');
      }
    } catch (err) {
      console.error('[Auth] login() error:', err);
    }
  }, []);

  const signup = useCallback(async () => {
    console.log('[Auth] signup() called');
    try {
      const client = await getAuth0Client();
      if (client) {
        await client.loginWithRedirect({
          authorizationParams: { screen_hint: 'signup' },
        });
      }
    } catch (err) {
      console.error('[Auth] signup() error:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    const client = await getAuth0Client();
    if (client) {
      await client.logout({ logoutParams: { returnTo: window.location.origin } });
    }
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const client = await getAuth0Client();
    if (!client) return null;
    try {
      return await client.getTokenSilently();
    } catch {
      return null;
    }
  }, []);

  const updateUserProfile = useCallback((firstName: string, lastName: string, displayName: string) => {
    setUser(prev => prev ? { ...prev, firstName, lastName, displayName } : prev);
  }, []);

  const needsProfileCompletion = !!user && (!user.firstName || !user.lastName);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    needsProfileCompletion,
    updateUserProfile,
    login,
    signup,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
