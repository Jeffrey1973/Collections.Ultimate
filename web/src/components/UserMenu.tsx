import { useAuth } from '../context/AuthContext';

/** Small login/logout + user info widget for the header/nav. */
export default function UserMenu() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <span style={{ opacity: 0.5, fontSize: '0.9rem' }}>Checking login…</span>;
  }

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={login}
        style={{
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Log In
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '0.9rem' }}>
        {user.displayName}
        {user.households.length > 0 && (
          <span style={{ opacity: 0.6, marginLeft: 4 }}>
            ({user.households.length} {user.households.length === 1 ? 'library' : 'libraries'})
          </span>
        )}
      </span>
      <button
        onClick={logout}
        style={{
          background: 'transparent',
          color: '#ef4444',
          border: '1px solid #ef4444',
          borderRadius: 6,
          padding: '4px 12px',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Log Out
      </button>
    </div>
  );
}
