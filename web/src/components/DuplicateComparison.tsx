import { Book } from '../api/books'

interface ComparisonBook {
  id?: string
  title?: string
  subtitle?: string
  author?: string
  isbn?: string
  isbn13?: string
  isbn10?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  format?: string
  binding?: string
  language?: string
  location?: string
  coverImageUrl?: string
  coverImageFallbacks?: string[]
  editionStatement?: string
}

interface DuplicateComparisonProps {
  newBook: Partial<Book>
  existingBooks: ComparisonBook[]
  matchReasons: string[]
  onAddAnyway: () => void
  onCancel: () => void
  onViewExisting: (id: string) => void
}

const fieldRows: { label: string; key: keyof ComparisonBook; icon: string }[] = [
  { label: 'Title', key: 'title', icon: '📖' },
  { label: 'Subtitle', key: 'subtitle', icon: '📄' },
  { label: 'Author', key: 'author', icon: '✍️' },
  { label: 'ISBN-13', key: 'isbn13', icon: '🔖' },
  { label: 'ISBN-10', key: 'isbn10', icon: '🔖' },
  { label: 'Publisher', key: 'publisher', icon: '🏢' },
  { label: 'Published', key: 'publishedDate', icon: '📅' },
  { label: 'Pages', key: 'pageCount', icon: '📃' },
  { label: 'Format', key: 'format', icon: '📐' },
  { label: 'Binding', key: 'binding', icon: '📕' },
  { label: 'Edition', key: 'editionStatement', icon: '🔢' },
  { label: 'Language', key: 'language', icon: '🌐' },
  { label: 'Location', key: 'location', icon: '📍' },
]

export default function DuplicateComparison({
  newBook,
  existingBooks,
  matchReasons,
  onAddAnyway,
  onCancel,
  onViewExisting,
}: DuplicateComparisonProps) {
  const newData: ComparisonBook = {
    title: newBook.title as string,
    subtitle: newBook.subtitle as string,
    author: newBook.author as string,
    isbn13: (newBook as any).isbn13 || (newBook as any).isbn,
    isbn10: (newBook as any).isbn10,
    publisher: newBook.publisher as string,
    publishedDate: newBook.publishedDate as string,
    pageCount: newBook.pageCount as number,
    format: (newBook as any).format,
    binding: (newBook as any).binding,
    language: newBook.language as string,
    location: (newBook as any).location,
    coverImageUrl: newBook.coverImageUrl as string,
    editionStatement: (newBook as any).editionStatement,
  }

  // Only show rows where at least one side has data
  const visibleRows = fieldRows.filter(row => {
    if (newData[row.key]) return true
    return existingBooks.some(eb => eb[row.key])
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        maxWidth: '900px', width: '100%', maxHeight: '90vh',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <h3 style={{ margin: 0, color: '#92400e', fontSize: '1.1rem' }}>Possible Duplicate Detected</h3>
          </div>
          <p style={{ color: '#78716c', fontSize: '0.85rem', margin: 0 }}>
            Compare the book you're adding with existing items in your library. If this is a different
            copy (e.g., different edition, gift copy), choose "Add Anyway".
          </p>
        </div>

        {/* Match reasons */}
        <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#fefce8', borderBottom: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {matchReasons.map((reason, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.75rem', borderRadius: '9999px',
                backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.8rem', fontWeight: 500,
                border: '1px solid #fde68a',
              }}>
                🔍 {reason}
              </span>
            ))}
          </div>
        </div>

        {/* Scrollable comparison body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
          {existingBooks.map((existing, ebIdx) => (
            <div key={ebIdx} style={{
              borderBottom: ebIdx < existingBooks.length - 1 ? '2px solid #e2e8f0' : undefined,
            }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 0,
                position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                  Field
                </div>
                <div style={{
                  padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem',
                  color: '#166534', textTransform: 'uppercase', backgroundColor: '#f0fdf4',
                  borderLeft: '1px solid #e2e8f0',
                }}>
                  ✨ New Book
                </div>
                <div style={{
                  padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem',
                  color: '#1e40af', textTransform: 'uppercase', backgroundColor: '#eff6ff',
                  borderLeft: '1px solid #e2e8f0',
                }}>
                  📚 Existing {existingBooks.length > 1 ? `(${ebIdx + 1} of ${existingBooks.length})` : 'Book'}
                  {existing.id && (
                    <button
                      onClick={() => onViewExisting(existing.id!)}
                      style={{
                        marginLeft: '0.5rem', padding: '0.15rem 0.5rem',
                        borderRadius: '4px', border: '1px solid #93c5fd',
                        background: '#dbeafe', color: '#1e40af', fontSize: '0.7rem',
                        cursor: 'pointer', fontWeight: 500,
                      }}
                    >
                      View →
                    </button>
                  )}
                </div>
              </div>

              {/* Cover images row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 0,
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  📷 Cover
                </div>
                <div style={{ padding: '0.75rem 1rem', borderLeft: '1px solid #f1f5f9', backgroundColor: '#fafff9' }}>
                  {newData.coverImageUrl ? (
                    <img src={newData.coverImageUrl} alt="New" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '60px', height: '90px', borderRadius: '4px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.65rem' }}>No Cover</div>
                  )}
                </div>
                <div style={{ padding: '0.75rem 1rem', borderLeft: '1px solid #f1f5f9', backgroundColor: '#f8fbff' }}>
                  {existing.coverImageUrl ? (
                    <img
                      src={existing.coverImageUrl}
                      alt="Existing"
                      data-fallbacks={JSON.stringify(existing.coverImageFallbacks || [])}
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
                      style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ width: '60px', height: '90px', borderRadius: '4px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.65rem' }}>No Cover</div>
                  )}
                </div>
              </div>

              {/* Data rows */}
              {visibleRows.map((row, ri) => {
                const newVal = newData[row.key]
                const existingVal = existing[row.key]
                const newStr = newVal != null ? String(newVal) : ''
                const existingStr = existingVal != null ? String(existingVal) : ''
                const isDifferent = newStr.toLowerCase() !== existingStr.toLowerCase() && newStr && existingStr

                return (
                  <div key={row.key} style={{
                    display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 0,
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: ri % 2 === 0 ? 'white' : '#fafafa',
                  }}>
                    <div style={{
                      padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#64748b',
                      fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      {row.icon} {row.label}
                    </div>
                    <div style={{
                      padding: '0.5rem 1rem', fontSize: '0.85rem', color: newStr ? '#1e293b' : '#cbd5e1',
                      borderLeft: '1px solid #f1f5f9',
                      backgroundColor: isDifferent ? '#fefce8' : undefined,
                      wordBreak: 'break-word',
                    }}>
                      {newStr || '—'}
                    </div>
                    <div style={{
                      padding: '0.5rem 1rem', fontSize: '0.85rem', color: existingStr ? '#1e293b' : '#cbd5e1',
                      borderLeft: '1px solid #f1f5f9',
                      backgroundColor: isDifferent ? '#fefce8' : undefined,
                      wordBreak: 'break-word',
                    }}>
                      {existingStr || '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: '0.75rem', justifyContent: 'space-between',
          backgroundColor: '#f8fafc', flexWrap: 'wrap',
        }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', alignSelf: 'center' }}>
            Different edition or extra copy? Add it. Same book already tracked? Cancel.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #d1d5db',
                background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onAddAnyway}
              style={{
                padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #f59e0b',
                background: '#fef3c7', color: '#92400e', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Add Anyway (Different Copy)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
