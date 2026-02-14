import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { setTokenProvider } from '../api/backend';

/**
 * Invisible component that wires the Auth0 token provider into the backend API client.
 * Must be rendered inside <AuthProvider>.
 */
export default function TokenBridge() {
  const { getAccessToken } = useAuth();

  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  return null;
}
