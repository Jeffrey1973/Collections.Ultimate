import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthHousehold {
  id: string;
  role: string;
}

interface AuthUser {
  accountId: string;
  displayName: string;
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
  /** Trigger Auth0 login redirect */
  login: () => void;
  /** Trigger Auth0 logout */
  logout: () => void;
  /** Get a valid access token for API calls */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
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
    },
    cacheLocation: 'localstorage',
  });
  return auth0Client;
}

// ── Provider ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5259';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: handle redirect callback + check existing session
  useEffect(() => {
    if (!AUTH0_ENABLED) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const client = await getAuth0Client();
        if (!client) { setIsLoading(false); return; }

        // Handle redirect callback
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && params.has('state')) {
          await client.handleRedirectCallback();
          window.history.replaceState({}, '', window.location.pathname);
        }

        const isAuth = await client.isAuthenticated();
        if (isAuth) {
          const token = await client.getTokenSilently();
          // Call our login endpoint to sync account
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (res.ok) {
            const data = await res.json();
            setUser({
              accountId: data.accountId,
              displayName: data.displayName,
              email: data.email,
              households: data.households,
            });
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = useCallback(async () => {
    const client = await getAuth0Client();
    if (client) {
      await client.loginWithRedirect();
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

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
