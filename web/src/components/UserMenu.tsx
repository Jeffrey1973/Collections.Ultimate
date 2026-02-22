import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** User menu with dropdown for secondary navigation + logout. */
export default function UserMenu() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const menuItems = [
    { label: '📥 Import Books', path: '/import' },
    { label: '🏠 Households', path: '/households' },
    { label: '✨ Batch Enrich', path: '/enrich' },
    { label: '🔍 Duplicates', path: '/duplicates' },
  ];

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: open ? '#f1f5f9' : 'transparent',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          color: '#1e293b',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>👤</span>
        {user.firstName || user.displayName}
        <span style={{ fontSize: '0.7rem', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: 6,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 200,
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* User info */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f1f5f9',
            fontSize: '0.85rem',
            color: '#64748b',
          }}>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>
              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.displayName}
            </div>
            {user.email && <div style={{ marginTop: 2 }}>{user.email}</div>}
          </div>

          {/* Menu items */}
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#374151',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </button>
          ))}

          {/* Logout */}
          <div style={{ borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={() => { logout(); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#ef4444',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              🚪 Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
