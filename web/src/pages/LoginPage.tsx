import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, signup } = useAuth()

  // Already logged in — redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Bookshelf background pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.07,
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 58px,
            #8b7355 58px,
            #8b7355 60px
          ),
          repeating-linear-gradient(
            90deg,
            #6b4423 0px,
            #6b4423 18px,
            #8b5e3c 18px,
            #8b5e3c 22px,
            #5c3d2e 22px,
            #5c3d2e 44px,
            #7a5c3a 44px,
            #7a5c3a 48px,
            #4a3728 48px,
            #4a3728 62px,
            #9b7653 62px,
            #9b7653 65px,
            #6b4423 65px,
            #6b4423 80px,
            #8b6e4e 80px,
            #8b6e4e 84px,
            #5a4030 84px,
            #5a4030 100px
          )
        `,
        backgroundSize: '100px 60px',
      }} />
      {/* Warm overlay gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(139, 90, 43, 0.15) 0%, rgba(26, 26, 46, 0.95) 70%)',
      }} />

      <div style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        padding: '3rem 2.5rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 80px rgba(139, 90, 43, 0.1)',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo / Title */}
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📚</div>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: '0.25rem',
        }}>
          Collections Ultimate
        </h1>
        <p style={{
          color: '#64748b',
          fontSize: '0.95rem',
          marginBottom: '2rem',
        }}>
          Your personal library management system
        </p>

        {/* Login / Sign Up Buttons */}
        {isLoading ? (
          <div style={{ padding: '1rem', color: '#64748b' }}>
            Checking authentication...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={login}
              style={{
                width: '100%',
                padding: '0.85rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'white',
                background: 'linear-gradient(135deg, #6b4423 0%, #8b5e3c 100%)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(107, 68, 35, 0.3)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #5a3a1e 0%, #7a4f30 100%)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 68, 35, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6b4423 0%, #8b5e3c 100%)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 68, 35, 0.3)';
              }}
            >
              Sign In
            </button>
            <button
              onClick={signup}
              style={{
                width: '100%',
                padding: '0.85rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#6b4423',
                background: 'transparent',
                border: '2px solid #6b4423',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(107, 68, 35, 0.06)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Create Account
            </button>
          </div>
        )}

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.8rem',
          color: '#94a3b8',
        }}>
          Secured with Auth0
        </p>
      </div>
    </div>
  )
}
