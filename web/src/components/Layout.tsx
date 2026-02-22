import { Link } from 'react-router-dom'
import { ReactNode } from 'react'
import HouseholdSelector from './HouseholdSelector.tsx'
import UserMenu from './UserMenu.tsx'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        <nav style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          <Link to="/" style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1e293b',
            textDecoration: 'none',
          }}>
            📚 Collections
          </Link>
          <HouseholdSelector />
          <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto' }}>
            <Link to="/library" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }}>
              Library
            </Link>
            <Link to="/add-book" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }}>
              Add Book
            </Link>
          </div>
          <UserMenu />
        </nav>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: 'white',
        borderTop: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        Collections Ultimate © 2026
      </footer>
    </div>
  )
}

export default Layout
