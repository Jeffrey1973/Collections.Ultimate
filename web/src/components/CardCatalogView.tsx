import { Book } from '../api/books'

interface CardCatalogViewProps {
  book: Book
}

function CardCatalogView({ book }: CardCatalogViewProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '500px',
      margin: '2rem auto',
      backgroundColor: '#f5f1e8',
      border: '2px solid #8b7355',
      borderRadius: '4px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      fontFamily: '"Courier New", monospace',
      padding: '1.5rem',
      position: 'relative',
    }}>
      {/* Card header hole punches */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '15px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#333',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '15px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#333',
      }} />

      <div style={{ paddingLeft: '30px' }}>
        {/* Call Number */}
        {book.callNumber && (
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#c41e3a',
          }}>
            {book.callNumber}
          </div>
        )}

        {/* Main Entry (Author) */}
        <div style={{
          fontSize: '1rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
        }}>
          {book.author || 'UNKNOWN AUTHOR'}
        </div>

        {/* Title */}
        <div style={{
          fontSize: '1.125rem',
          marginBottom: '0.75rem',
          marginLeft: '2rem',
        }}>
          {book.title}
          {book.edition && ` / ${book.edition}`}
        </div>

        {/* Divider line */}
        <div style={{
          borderTop: '1px solid #8b7355',
          margin: '0.75rem 0',
        }} />

        {/* Imprint (Publisher info) */}
        <div style={{
          fontSize: '0.875rem',
          marginBottom: '0.5rem',
          marginLeft: '2rem',
        }}>
          {book.placeOfPublication && `${book.placeOfPublication} : `}
          {book.publisher}
          {book.publishedDate && `, ${book.publishedDate}`}
        </div>

        {/* Physical Description */}
        {(book.pageCount || book.dimensions || book.physicalDescription) && (
          <div style={{
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            marginLeft: '2rem',
          }}>
            {book.physicalDescription || 
             `${book.pageCount ? `${book.pageCount} p.` : ''}${book.dimensions ? ` ; ${book.dimensions}` : ''}`}
          </div>
        )}

        {/* Series */}
        {book.series && (
          <div style={{
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            marginLeft: '2rem',
            fontStyle: 'italic',
          }}>
            ({book.series})
          </div>
        )}

        {/* Notes */}
        {book.notes && (
          <div style={{
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            marginLeft: '2rem',
          }}>
            {book.notes}
          </div>
        )}

        {/* Divider line */}
        <div style={{
          borderTop: '1px solid #8b7355',
          margin: '0.75rem 0',
        }} />

        {/* Subject Headings */}
        {(book.subjects && book.subjects.length > 0) && (
          <div style={{ marginBottom: '0.5rem' }}>
            {book.subjects.map((subject, index) => (
              <div key={index} style={{
                fontSize: '0.875rem',
                marginBottom: '0.25rem',
              }}>
                <span style={{ marginRight: '0.5rem' }}>{index + 1}.</span>
                {subject}
              </div>
            ))}
          </div>
        )}

        {/* Categories (if no subjects) */}
        {(!book.subjects || book.subjects.length === 0) && book.categories && book.categories.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {book.categories.map((category, index) => (
              <div key={index} style={{
                fontSize: '0.875rem',
                marginBottom: '0.25rem',
              }}>
                <span style={{ marginRight: '0.5rem' }}>{index + 1}.</span>
                {category}
              </div>
            ))}
          </div>
        )}

        {/* ISBN */}
        {book.isbn && (
          <div style={{
            fontSize: '0.875rem',
            marginTop: '0.75rem',
          }}>
            ISBN: {book.isbn}
          </div>
        )}

        {/* Library stamp */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px dashed #8b7355',
          fontSize: '0.75rem',
          color: '#666',
          textAlign: 'center',
        }}>
          COLLECTIONS ULTIMATE LIBRARY
          <div style={{ marginTop: '0.25rem' }}>
            Added: {new Date(book.dateAdded).toLocaleDateString()}
          </div>
          {book.dataSources && book.dataSources.length > 0 && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.7rem',
              color: '#999',
              fontStyle: 'italic',
            }}>
              Data from: {book.dataSources.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CardCatalogView
