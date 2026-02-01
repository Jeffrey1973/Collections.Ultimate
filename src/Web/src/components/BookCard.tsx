import { Book } from '../api/books'

interface BookCardProps {
  book: Book
  onClick?: () => void
}

function BookCard({ book, onClick }: BookCardProps) {
  // Get first letter for placeholder
  const firstLetter = book.title.charAt(0).toUpperCase()

  return (
    <div className="book-card" onClick={onClick}>
      <div className="book-cover-placeholder">
        {firstLetter}
      </div>
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        {book.authors && (
          <p className="book-author">{book.authors}</p>
        )}
        {book.status && (
          <span className={`book-status ${book.status.toLowerCase()}`}>
            {book.status}
          </span>
        )}
      </div>
    </div>
  )
}

export default BookCard
