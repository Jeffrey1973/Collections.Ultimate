import { Book } from '../api/books'

interface BookSelectionModalProps {
  books: Array<Partial<Book> & { isbn?: string }>
  onSelect: (book: Partial<Book> & { isbn?: string }) => void
  onClose: () => void
}

export default function BookSelectionModal({ books, onSelect, onClose }: BookSelectionModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
              Select a Book
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Found {books.length} {books.length === 1 ? 'result' : 'results'}. Click on a book to use it.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.5rem',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Results List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {books.map((book, index) => (
              <button
                key={book.isbn || index}
                onClick={() => onSelect(book)}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.backgroundColor = 'white'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Cover Image */}
                <div
                  style={{
                    flexShrink: 0,
                    width: '80px',
                    height: '120px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {book.coverImageUrl ? (
                    <img
                      src={book.coverImageUrl}
                      alt={book.title || 'Book cover'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '2rem', color: '#cbd5e1' }}>📚</span>
                  )}
                </div>

                {/* Book Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {book.title}
                  </h3>
                  
                  {book.subtitle && (
                    <p
                      style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.875rem',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {book.subtitle}
                    </p>
                  )}

                  {book.author && (
                    <p
                      style={{
                        margin: '0.5rem 0 0 0',
                        fontSize: '0.875rem',
                        color: '#475569',
                        fontWeight: 500,
                      }}
                    >
                      by {book.author}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    {book.publishedDate && (
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                        }}
                      >
                        📅 {book.publishedDate}
                      </span>
                    )}
                    {book.publisher && (
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                        }}
                      >
                        🏢 {book.publisher}
                      </span>
                    )}
                    {book.pageCount && (
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                        }}
                      >
                        📄 {book.pageCount} pages
                      </span>
                    )}
                    {book.isbn && (
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                        }}
                      >
                        ISBN: {book.isbn}
                      </span>
                    )}
                  </div>

                  {book.dataSources && book.dataSources.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Sources: {book.dataSources.join(', ')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
