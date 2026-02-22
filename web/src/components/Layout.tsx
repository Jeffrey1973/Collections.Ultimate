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
        padding: '0.75rem 1rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        <nav className="header-nav">
          <Link to="/" className="header-logo">
            📚 Collections
          </Link>
          <HouseholdSelector />
          <div className="header-links">
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
      <main className="main-content">
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: 'white',
        borderTop: '1px solid #e2e8f0',
        padding: '1rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.75rem',
      }}>
        Collections Ultimate © 2026
      </footer>
    </div>
  )
}

export default Layout
