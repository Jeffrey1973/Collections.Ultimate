import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, uploadItemCover, deleteItemCover } from '../api/backend'
import { mapItemResponseToBook, softDeleteItem, hardDeleteItem, restoreItem, moveItemToHousehold } from '../api/backend'
import { Book } from '../api/books'
import { FIELD_CATEGORIES, FIELD_DEFINITIONS } from '../config/field-config'
import { useHousehold } from '../context/HouseholdContext'

function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { households } = useHousehold()
  const [book, setBook] = useState<Book | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basic', 'identifiers']) // Start with basic and identifiers expanded
  )
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMoveDropdown, setShowMoveDropdown] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const moveDropdownRef = useRef<HTMLDivElement>(null)

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

  async function handleSoftDelete() {
    if (!id || !book) return
    setIsDeleting(true)
    try {
      await softDeleteItem(id)
      navigate('/library')
    } catch (err) {
      console.error('Failed to soft-delete:', err)
      alert('Failed to mark book as previously owned')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleHardDelete() {
    if (!id || !book) return
    setIsDeleting(true)
    try {
      await hardDeleteItem(id)
      navigate('/library')
    } catch (err) {
      console.error('Failed to delete:', err)
      alert('Failed to delete book')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRestore() {
    if (!id || !book) return
    try {
      await restoreItem(id)
      loadBook(id)
    } catch (err) {
      console.error('Failed to restore:', err)
      alert('Failed to restore book')
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setIsUploadingCover(true)
    try {
      const result = await uploadItemCover(id, file)
      // Update book with new custom cover URL
      setBook(prev => prev ? { ...prev, coverImageUrl: result.customCoverUrl, customCoverUrl: result.customCoverUrl } : prev)
    } catch (err: any) {
      alert(err.message || 'Failed to upload cover')
      console.error('Cover upload failed:', err)
    } finally {
      setIsUploadingCover(false)
      if (coverFileRef.current) coverFileRef.current.value = ''
    }
  }

  async function handleCoverDelete() {
    if (!id) return
    if (!confirm('Remove your custom cover photo? The original cover image (if any) will be shown instead.')) return
    setIsUploadingCover(true)
    try {
      await deleteItemCover(id)
      // Re-load to get the edition cover back
      loadBook(id)
    } catch (err) {
      alert('Failed to remove custom cover')
      console.error(err)
    } finally {
      setIsUploadingCover(false)
    }
  }

  async function handleMove(targetHouseholdId: string, targetName: string) {
    if (!id || !book) return
    setIsMoving(true)
    setShowMoveDropdown(false)
    try {
      await moveItemToHousehold(id, targetHouseholdId)
      navigate('/library')
    } catch (err) {
      console.error('Failed to move book:', err)
      alert(`Failed to move book to ${targetName}`)
    } finally {
      setIsMoving(false)
    }
  }

  // Close move dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setShowMoveDropdown(false)
      }
    }
    if (showMoveDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMoveDropdown])

  // Other households this book could be moved to
  const otherHouseholds = households.filter(h => h.id !== (book as any)?.householdId)

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
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/library')} className="btn btn-secondary">
          ← Back to Library
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {(book as any).status === 'Previously Owned' && (
            <button
              onClick={handleRestore}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #10b981',
                background: '#ecfdf5', color: '#059669', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              ↩ Restore to Library
            </button>
          )}
          <button onClick={() => navigate(`/book/${id}/edit`)} style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #3b82f6',
            background: '#eff6ff', color: '#2563eb', fontWeight: 600, cursor: 'pointer',
            fontSize: '0.85rem',
          }}>
            ✏️ Edit
          </button>
          {/* Move to another household */}
          {otherHouseholds.length > 0 && (
            <div ref={moveDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                disabled={isMoving}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #8b5cf6',
                  background: isMoving ? '#ede9fe' : '#f5f3ff', color: '#7c3aed', fontWeight: 600,
                  cursor: isMoving ? 'wait' : 'pointer', fontSize: '0.85rem',
                  opacity: isMoving ? 0.7 : 1,
                }}
              >
                {isMoving ? '⏳ Moving...' : '📦 Move to...'}
              </button>
              {showMoveDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem',
                  backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, minWidth: '200px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#64748b',
                    borderBottom: '1px solid #f1f5f9', fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    Move to household
                  </div>
                  {otherHouseholds.map(h => (
                    <button
                      key={h.id}
                      onClick={() => handleMove(h.id, h.name)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 0.75rem', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: '0.875rem', color: '#1e293b',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f3ff')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      🏠 {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setShowDeleteModal(true)} style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ef4444',
            background: '#fef2f2', color: '#dc2626', fontWeight: 600, cursor: 'pointer',
            fontSize: '0.85rem',
          }}>
            🗑️ Remove
          </button>
        </div>
      </div>

      {/* Previously Owned Banner */}
      {(book as any).status === 'Previously Owned' && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
          backgroundColor: '#fef3c7', border: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>📦</span>
          <span style={{ color: '#92400e', fontWeight: 500 }}>This book is marked as Previously Owned</span>
        </div>
      )}

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
        {/* Cover Image with Upload */}
        <div style={{ flexShrink: 0, position: 'relative', width: '200px' }}>
          <input
            ref={coverFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            style={{ display: 'none' }}
            onChange={handleCoverUpload}
          />
          {book.coverImageUrl ? (
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
                width: '200px',
                height: '300px',
                objectFit: 'cover',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            />
          ) : (
            <div style={{
              width: '200px', height: '300px', borderRadius: '8px',
              backgroundColor: '#f1f5f9', border: '2px dashed #cbd5e1',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '0.5rem', color: '#94a3b8',
            }}>
              <span style={{ fontSize: '2rem' }}>📷</span>
              <span style={{ fontSize: '0.85rem', textAlign: 'center', padding: '0 0.5rem' }}>No cover image</span>
            </div>
          )}
          {/* Cover action buttons */}
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => coverFileRef.current?.click()}
              disabled={isUploadingCover}
              title="Upload cover photo"
              style={{
                padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: '0.75rem',
                cursor: isUploadingCover ? 'wait' : 'pointer', fontWeight: 500,
              }}
            >
              {isUploadingCover ? '⏳ Uploading…' : '📷 Upload Cover'}
            </button>
            {book.customCoverUrl && (
              <button
                onClick={handleCoverDelete}
                disabled={isUploadingCover}
                title="Remove custom cover photo"
                style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #fca5a5',
                  background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem',
                  cursor: isUploadingCover ? 'wait' : 'pointer', fontWeight: 500,
                }}
              >
                ✕ Remove
              </button>
            )}
          </div>
        </div>

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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowDeleteModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Remove "{book.title}"?
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Choose how you'd like to handle this book:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Soft Delete */}
              <button
                onClick={handleSoftDelete}
                disabled={isDeleting}
                style={{
                  padding: '1rem', borderRadius: '8px', border: '2px solid #f59e0b',
                  backgroundColor: '#fffbeb', cursor: 'pointer', textAlign: 'left',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                  📦 Mark as Previously Owned
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a16207' }}>
                  Keep the record but mark it as no longer in your collection. You can restore it later.
                </div>
              </button>

              {/* Hard Delete */}
              <button
                onClick={handleHardDelete}
                disabled={isDeleting}
                style={{
                  padding: '1rem', borderRadius: '8px', border: '2px solid #ef4444',
                  backgroundColor: '#fef2f2', cursor: 'pointer', textAlign: 'left',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>
                  🗑️ Permanently Delete
                </div>
                <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                  Remove the book completely from your library. This cannot be undone.
                </div>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 600,
                  color: '#64748b',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookDetailPage
