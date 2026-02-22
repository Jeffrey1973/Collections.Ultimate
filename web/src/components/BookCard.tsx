import { Book } from '../api/books'

interface BookCardProps {
  book: Book
  displayFields?: string[]
}

function formatFieldValue(value: any): string | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map(v => (typeof v === 'object' ? (v.text || v.name || JSON.stringify(v)) : v)).join(', ')
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function BookCard({ book, displayFields }: BookCardProps) {
  // Use displayFields if provided, otherwise fall back to defaults
  const fieldsToShow = displayFields ?? ['author', 'isbn']

  return (
    <div className="card">
      {book.coverImageUrl && (
        <img
          src={book.coverImageUrl}
          alt={book.title}
          data-fallbacks={JSON.stringify(book.coverImageFallbacks || [])}
          data-fallback-index="0"
          onError={(e) => {
            const img = e.currentTarget
            const fallbacks: string[] = JSON.parse(img.dataset.fallbacks || '[]')
            const idx = parseInt(img.dataset.fallbackIndex || '0', 10)
            if (idx < fallbacks.length) {
              img.dataset.fallbackIndex = String(idx + 1)
              img.src = fallbacks[idx]
            } else {
              img.style.display = 'none'
            }
          }}
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
        {book.enrichedAt && (
          <span
            title={`Enriched ${new Date(book.enrichedAt).toLocaleDateString()}${book.enrichmentSources?.length ? ' via ' + book.enrichmentSources.join(', ') : ''}`}
            style={{
              display: 'inline-block',
              marginLeft: '0.35rem',
              fontSize: '0.55rem',
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '9999px',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              verticalAlign: 'middle',
            }}
          >
            ✦
          </span>
        )}
        {book.inventoryVerifiedDate && (
          <span
            title={`Verified ${new Date(book.inventoryVerifiedDate).toLocaleDateString()}`}
            style={{
              display: 'inline-block',
              marginLeft: '0.35rem',
              fontSize: '0.55rem',
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '9999px',
              backgroundColor: '#dbeafe',
              color: '#2563eb',
              verticalAlign: 'middle',
            }}
          >
            ✓
          </span>
        )}
      </h3>
      {fieldsToShow.map(fieldKey => {
        const raw = (book as any)[fieldKey]
        const display = formatFieldValue(raw)
        if (!display) return null
        return (
          <p key={fieldKey} style={{
            color: '#64748b',
            fontSize: '0.875rem',
            marginBottom: '0.25rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {display}
          </p>
        )
      })}
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
