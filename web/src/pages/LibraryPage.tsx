import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard.tsx'
import CardCatalogView from '../components/CardCatalogView.tsx'
import { Book } from '../api/books'
import { getItems, mapItemResponseToBook } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'

// Available fields for display configuration
const DISPLAY_FIELDS = [
  { key: 'author', label: 'Author' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'publishedDate', label: 'Year' },
  { key: 'pageCount', label: 'Pages' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'language', label: 'Language' },
  { key: 'format', label: 'Format' },
  { key: 'subjects', label: 'Subjects' },
]

function LibraryPage() {
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'catalog'>('list')
  const [showSettings, setShowSettings] = useState(false)
  const [displayFields, setDisplayFields] = useState<string[]>(['author', 'publisher', 'publishedDate', 'isbn'])

  useEffect(() => {
    if (selectedHousehold) {
      loadBooks()
    }
  }, [selectedHousehold])

  async function loadBooks() {
    if (!selectedHousehold) return
    
    try {
      setIsLoading(true)
      setError(null)
      console.log('📚 Loading items for household:', selectedHousehold.id)
      
      // Use items endpoint instead of books - it returns all types
      const result = await getItems(selectedHousehold.id, { 
        q: searchQuery || undefined,
        take: 100 
      })
      
      console.log('📦 Items response:', result)
      
      // Use the comprehensive mapping function to extract ALL fields from backend
      const mappedBooks: Book[] = result.map(mapItemResponseToBook)
      
      setBooks(mappedBooks)
    } catch (err) {
      setError('Failed to load books. Is the backend API running on port 5258?')
      console.error('Failed to load books:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadBooks()
  }

  // Show loading state while households are loading
  if (isLoadingHousehold || !selectedHousehold) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">My Library</h1>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          {isLoadingHousehold ? 'Loading...' : 'No household selected'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Library</h1>
        <p className="page-subtitle">
          {books.length} book{books.length !== 1 ? 's' : ''} in your collection
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by title, author, ISBN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => {
            if (viewMode === 'list') setViewMode('grid')
            else if (viewMode === 'grid') setViewMode('catalog')
            else setViewMode('list')
          }}
        >
          {viewMode === 'list' ? '📋 List' : viewMode === 'grid' ? '📚 Grid' : '📇 Catalog'}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Display
        </button>
      </form>

      {/* Display Settings */}
      {showSettings && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Display Fields
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {DISPLAY_FIELDS.map(field => (
              <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={displayFields.includes(field.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDisplayFields([...displayFields, field.key])
                    } else {
                      setDisplayFields(displayFields.filter(f => f !== field.key))
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem' }}>{field.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading">
          Loading books...
        </div>
      )}

      {error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={loadBooks} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && books.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>No books in your library yet.</p>
          <p>Add your first book to get started!</p>
        </div>
      )}

      {!isLoading && !error && books.length > 0 && (
        <>
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {books.map((book) => (
                <div
                  key={book.id}
                  onClick={() => navigate(`/book/${book.id}`)}
                  style={{
                    backgroundColor: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Cover thumbnail */}
                  {book.coverImageUrl && (
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                      style={{
                        width: '50px',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        flexShrink: 0
                      }}
                    />
                  )}
                  
                  {/* Title - always shown */}
                  <div style={{ 
                    flex: '1 1 300px',
                    minWidth: 0
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '0.25rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {book.title}
                    </div>
                    {book.subtitle && (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {book.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Configurable fields */}
                  {displayFields.map(fieldKey => {
                    const value = (book as any)[fieldKey]
                    if (!value || (Array.isArray(value) && value.length === 0)) return null
                    
                    const fieldLabel = DISPLAY_FIELDS.find(f => f.key === fieldKey)?.label || fieldKey
                    const displayValue = Array.isArray(value) ? value.join(', ') : value
                    
                    return (
                      <div 
                        key={fieldKey}
                        style={{
                          flex: '0 0 auto',
                          minWidth: '150px',
                          maxWidth: '200px'
                        }}
                      >
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '0.125rem'
                        }}>
                          {fieldLabel}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#475569',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {displayValue}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="book-grid">
              {books.map((book) => (
                <div key={book.id} onClick={() => navigate(`/book/${book.id}`)} style={{ cursor: 'pointer' }}>
                  <BookCard book={book} />
                </div>
              ))}
            </div>
          )}

          {viewMode === 'catalog' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              alignItems: 'center',
            }}>
              {books.map((book) => (
                <div key={book.id} onClick={() => navigate(`/book/${book.id}`)} style={{ cursor: 'pointer' }}>
                  <CardCatalogView book={book} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LibraryPage
