import { useState, useEffect } from 'react'
import BookCard from '../components/BookCard.tsx'
import CardCatalogView from '../components/CardCatalogView.tsx'
import { Book } from '../api/books'
import { getItems } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'

function LibraryPage() {
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const [books, setBooks] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'catalog'>('grid')

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
      
      // Map backend ItemResponse to frontend Book format
      const mappedBooks: Book[] = result.map((item) => {
        // Extract work details (title, authors)
        const title = item.title || item.work?.title || 'Untitled'
        const authors = item.work?.contributors
          ?.sort((a, b) => a.ordinal - b.ordinal)
          .map(c => c.displayName)
          .join(', ') || 'Unknown Author'
        
        // Extract edition details (ISBN, publisher, year, pages)
        const isbn13 = item.edition?.identifiers?.find(id => id.identifierTypeId === 2)?.value
        const isbn10 = item.edition?.identifiers?.find(id => id.identifierTypeId === 1)?.value
        const publisher = item.edition?.publisher
        const publishedYear = item.edition?.publishedYear
        const pageCount = item.edition?.pageCount
        const description = item.work?.description || item.edition?.description
        
        // Generate cover URL if edition exists
        const coverImageUrl = item.editionId 
          ? `http://localhost:5258/api/editions/${item.editionId}/cover` 
          : undefined
        
        return {
          id: item.itemId,
          householdId: item.householdId,
          title,
          author: authors,
          isbn: isbn13 || isbn10 || '',
          isbn10,
          isbn13,
          coverImageUrl,
          description,
          publisher,
          publishedDate: publishedYear ? `${publishedYear}` : undefined,
          pageCount,
          categories: [],
          language: undefined,
          dateAdded: item.acquiredOn || new Date().toISOString(),
          subjects: [],
          notes: item.notes,
        }
      })
      
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
          onClick={() => setViewMode(viewMode === 'grid' ? 'catalog' : 'grid')}
        >
          {viewMode === 'grid' ? '📇 Card Catalog' : '📚 Grid'}
        </button>
      </form>

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
          {viewMode === 'grid' ? (
            <div className="book-grid">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              alignItems: 'center',
            }}>
              {books.map((book) => (
                <CardCatalogView key={book.id} book={book} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LibraryPage
