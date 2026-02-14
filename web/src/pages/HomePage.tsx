import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome to Collections Ultimate</h1>
        <p className="page-subtitle">
          Your personal book library management system
        </p>
      </div>



      <div className="book-grid">

        <Link to="/library" className="card" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📖</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Browse Library</h2>
          <p style={{ color: '#64748b' }}>
            View and search all books in your collection
          </p>
        </Link>
        
        <Link to="/add-book" className="card" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>➕</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Add New Book</h2>
          <p style={{ color: '#64748b' }}>
            Add a book to your collection manually or by ISBN
          </p>
        </Link>

        <Link to="/households" className="card" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏠</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Households</h2>
          <p style={{ color: '#64748b' }}>
            Manage household members and shared libraries
          </p>
        </Link>

      </div>

      <div style={{ margin: '2rem 0 1rem', padding: '0 0.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Coming Soon
        </h3>
      </div>

      <div className="book-grid">

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Reading Log</h2>
          <p style={{ color: '#64748b' }}>
            Track your reading progress and history
          </p>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Authors</h2>
          <p style={{ color: '#64748b' }}>
            Explore author information and their works
          </p>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏢</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Publishers</h2>
          <p style={{ color: '#64748b' }}>
            Browse publishers and their catalogs
          </p>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🗺️</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Maps</h2>
          <p style={{ color: '#64748b' }}>
            Visualize your collection by geography and origin
          </p>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✏️</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Notes &amp; Quotes</h2>
          <p style={{ color: '#64748b' }}>
            Save highlights, annotations, and favorite passages
          </p>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📕</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Full Text Reader</h2>
          <p style={{ color: '#64748b' }}>
            Read digital books directly in your browser
          </p>
        </div>

      </div>
    </div>
  )
}

export default HomePage
