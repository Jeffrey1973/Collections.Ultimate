import { useState, useEffect } from 'react'
import BookCard from '../components/BookCard'
import { Book, searchBooks } from '../api/books'

function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For demo purposes, using a placeholder household ID
  // In a real app, this would come from authentication/user context
  const householdId = '00000000-0000-0000-0000-000000000001'

  useEffect(() => {
    loadBooks()
  }, [])

  async function loadBooks() {
    try {
      setIsLoading(true)
      setError(null)
      const result = await searchBooks(householdId, searchQuery)
      setBooks(result)
    } catch (err) {
      setError('Failed to load books. Is the API running?')
      console.error('Failed to load books:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadBooks()
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
        <div className="book-grid">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}

export default LibraryPage
