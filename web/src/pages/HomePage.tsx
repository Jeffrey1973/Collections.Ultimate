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

        <div className="card">
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Reading Log</h2>
          <p style={{ color: '#64748b' }}>
            Track your reading progress and history
          </p>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Coming soon</span>
        </div>

        <div className="card">
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Authors</h2>
          <p style={{ color: '#64748b' }}>
            Explore author information and their works
          </p>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Coming soon</span>
        </div>



      </div>
    </div>
  )
}

export default HomePage
