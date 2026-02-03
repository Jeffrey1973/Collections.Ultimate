import { Book } from '../api/books'

interface BookCardProps {
  book: Book
}

function BookCard({ book }: BookCardProps) {
  return (
    <div className="card">
      {book.coverImageUrl && (
        <img
          src={book.coverImageUrl}
          alt={book.title}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        />
      )}
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 600,
        color: '#1e293b',
        marginBottom: '0.5rem',
        lineHeight: '1.4',
      }}>
        {book.title}
      </h3>
      <p style={{
        color: '#64748b',
        fontSize: '0.875rem',
        marginBottom: '0.5rem',
      }}>
        {book.author}
      </p>
      {book.isbn && (
        <p style={{
          color: '#94a3b8',
          fontSize: '0.75rem',
        }}>
          ISBN: {book.isbn}
        </p>
      )}
      {book.dataSources && book.dataSources.length > 0 && (
        <p style={{
          color: '#cbd5e1',
          fontSize: '0.65rem',
          marginTop: '0.5rem',
          fontStyle: 'italic',
        }}>
          📚 {book.dataSources.join(' • ')}
        </p>
      )}
    </div>
  )
}

export default BookCard
