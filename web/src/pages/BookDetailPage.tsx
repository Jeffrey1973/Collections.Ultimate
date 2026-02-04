import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem } from '../api/backend'
import { mapItemResponseToBook } from '../api/backend'
import { Book } from '../api/books'
import { FIELD_CATEGORIES, FIELD_DEFINITIONS } from '../config/field-config'

function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basic', 'identifiers']) // Start with basic and identifiers expanded
  )

  useEffect(() => {
    if (id) {
      loadBook(id)
    }
  }, [id])

  async function loadBook(itemId: string) {
    try {
      setIsLoading(true)
      setError(null)
      const item = await getItem(itemId)
      const mappedBook = mapItemResponseToBook(item)
      setBook(mappedBook)
    } catch (err) {
      setError('Failed to load book details')
      console.error('Failed to load book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function toggleCategory(categoryKey: string) {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey)
    } else {
      newExpanded.add(categoryKey)
    }
    setExpandedCategories(newExpanded)
  }

  function renderFieldValue(value: any): string {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) {
      // Handle array of objects (like subjects with text property)
      if (value.length > 0 && typeof value[0] === 'object') {
        return value.map(item => {
          if (item.text) return item.text
          if (item.name) return item.name
          if (item.value) return item.value
          return JSON.stringify(item)
        }).join(', ')
      }
      return value.join(', ')
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <button onClick={() => navigate('/library')} className="btn btn-secondary">
            ← Back to Library
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div>
        <div className="page-header">
          <button onClick={() => navigate('/library')} className="btn btn-secondary">
            ← Back to Library
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <p>{error || 'Book not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate('/library')} className="btn btn-secondary">
          ← Back to Library
        </button>
      </div>

      {/* Book Header Section */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        marginBottom: '3rem',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* Cover Image */}
        {book.coverImageUrl && (
          <div style={{ flexShrink: 0 }}>
            <img
              src={book.coverImageUrl}
              alt={book.title}
              onError={(e) => e.currentTarget.style.display = 'none'}
              style={{
                width: '200px',
                height: '300px',
                objectFit: 'cover',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            />
          </div>
        )}

        {/* Main Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {book.title}
          </h1>
          {book.subtitle && (
            <h2 style={{ fontSize: '1.25rem', color: '#64748b', fontWeight: 400, marginBottom: '1rem' }}>
              {book.subtitle}
            </h2>
          )}
          <p style={{ fontSize: '1.125rem', color: '#475569', marginBottom: '1rem' }}>
            by {book.author}
          </p>
          
          {/* Quick Info Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginTop: '1.5rem'
          }}>
            {book.publisher && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Publisher
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{book.publisher}</div>
              </div>
            )}
            {book.publishedDate && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Published
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{book.publishedDate}</div>
              </div>
            )}
            {book.pageCount && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Pages
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{book.pageCount}</div>
              </div>
            )}
            {book.isbn && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  ISBN
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b', fontFamily: 'monospace' }}>{book.isbn}</div>
              </div>
            )}
          </div>

          {/* Description */}
          {book.description && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Description
              </div>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: '1.6' }}>
                {book.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Field Categories */}
      <div style={{ marginBottom: '2rem' }}>
        {FIELD_CATEGORIES.map((category) => {
          const fields = FIELD_DEFINITIONS.filter(f => f.category === category.key)
          const hasData = fields.some(field => {
            const value = (book as any)[field.key]
            return value !== undefined && value !== null && value !== '' && 
                   (!Array.isArray(value) || value.length > 0)
          })

          // Skip categories with no data
          if (!hasData) return null

          const isExpanded = expandedCategories.has(category.key)

          return (
            <div
              key={category.key}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.key)}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <span>
                  <span style={{ marginRight: '0.5rem' }}>{category.icon}</span>
                  {category.label}
                  <span style={{ 
                    marginLeft: '0.75rem', 
                    fontSize: '0.75rem', 
                    color: '#94a3b8',
                    fontWeight: 400 
                  }}>
                    {fields.filter(f => (book as any)[f.key]).length} fields
                  </span>
                </span>
                <span style={{ color: '#64748b' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div style={{ 
                  padding: '0 1.5rem 1.5rem 1.5rem',
                  borderTop: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem'
                  }}>
                    {fields.map((field) => {
                      const value = (book as any)[field.key]
                      
                      // Skip empty fields
                      if (value === undefined || value === null || value === '' ||
                          (Array.isArray(value) && value.length === 0)) {
                        return null
                      }

                      // Skip description since it's already in the header
                      if (field.key === 'description') {
                        return null
                      }

                      return (
                        <div key={field.key}>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginBottom: '0.25rem',
                            fontWeight: 500
                          }}>
                            {field.label}
                          </div>
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#1e293b',
                            wordBreak: 'break-word'
                          }}>
                            {renderFieldValue(value)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <button className="btn btn-secondary" onClick={() => navigate('/library')}>
          ← Back to Library
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/book/${id}/edit`)}>
          ✏️ Edit Book
        </button>
      </div>
    </div>
  )
}

export default BookDetailPage
