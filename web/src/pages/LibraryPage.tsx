import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard.tsx'
import CardCatalogView from '../components/CardCatalogView.tsx'
import { Book } from '../api/books'
import { getItems, mapItemResponseToBook, mapSearchResultToBook, updateItem, softDeleteItem, hardDeleteItem } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'
import { FIELD_DEFINITIONS, FIELD_CATEGORIES, type FieldConfig, type CategoryKey } from '../config/field-config'

// Default fields shown in list/grid/catalog views
const DEFAULT_DISPLAY_FIELDS = ['author', 'publisher', 'publishedDate', 'isbn']

// Fields that don't make sense to show as columns (images, large text, internal IDs)
const EXCLUDED_DISPLAY_KEYS = new Set([
  'id', 'householdId', 'dateAdded', 'title', 'subtitle', // always shown separately
  'coverImageUrl', 'coverImageSmallThumbnail', 'coverImageThumbnail',
  'coverImageSmall', 'coverImageMedium', 'coverImageLarge', 'coverImageExtraLarge',
  'description', 'tableOfContents', 'excerpt', 'firstSentence', 'textSnippet', // too long for columns
  'etag', 'selfLink', 'contentVersion', // internal
])

// All choosable fields, grouped by category
const ALL_DISPLAY_FIELDS: { key: string; label: string; category: CategoryKey }[] = FIELD_DEFINITIONS
  .filter(f => !EXCLUDED_DISPLAY_KEYS.has(f.key as string))
  .map(f => ({ key: f.key as string, label: f.label, category: f.category }))

const STORAGE_KEY = 'library_display_fields'

function loadSavedFields(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return DEFAULT_DISPLAY_FIELDS
}

function LibraryPage() {
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'catalog'>('list')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPreviouslyOwned, setShowPreviouslyOwned] = useState(false)
  const [enrichmentFilter, setEnrichmentFilter] = useState<'all' | 'enriched' | 'unenriched'>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [displayFields, setDisplayFields] = useState<string[]>(loadSavedFields)
  const [fieldSearch, setFieldSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Batch enrichment selection
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())

  // Tools dropdown
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement>(null)

  // Close tools menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false)
      }
    }
    if (showToolsMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showToolsMenu])

  // Persist display field choices
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(displayFields))
  }, [displayFields])

  useEffect(() => {
    if (selectedHousehold) {
      loadBooks()
    }
  }, [selectedHousehold])

  // Debounced search: fires 300ms after the user stops typing
  useEffect(() => {
    if (!selectedHousehold) return
    // Skip debounce on initial load (searchQuery is '')
    // Allow empty query to reset to full list
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      loadBooks()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  async function loadBooks() {
    if (!selectedHousehold) return
    
    try {
      setIsLoading(true)
      setError(null)
      console.log('📚 Loading items for household:', selectedHousehold.id)
      
      // Use items endpoint instead of books - it returns all types
      const result = await getItems(selectedHousehold.id, { 
        q: searchQuery || undefined,
        take: searchQuery ? 10000 : 500,
      })
      
      console.log('📦 Items response:', result)
      
      setTotalCount(result.totalCount)
      // Map search results to Book objects — the list endpoint now includes tags/subjects
      const mappedBooks: Book[] = result.items.map(mapSearchResultToBook)
      
      setBooks(mappedBooks)
    } catch (err) {
      setError('Failed to load books. Is the backend API running on port 5259?')
      console.error('Failed to load books:', err)
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // Immediate search on Enter key
    if (debounceRef.current) clearTimeout(debounceRef.current)
    loadBooks()
  }

  // Filter books based on ownership status
  const activeBooks = books.filter(b => (b as any).status !== 'Previously Owned' && (b as any).status !== 'Deleted')
  const previouslyOwned = books.filter(b => (b as any).status === 'Previously Owned')
  const displayedBooks = (() => {
    let base = showPreviouslyOwned ? previouslyOwned : activeBooks
    if (enrichmentFilter === 'enriched') base = base.filter(b => !!(b as any).enrichedAt)
    if (enrichmentFilter === 'unenriched') base = base.filter(b => !(b as any).enrichedAt)
    return base
  })()

  async function handleSoftDelete(bookId: string) {
    try {
      setIsDeleting(true)
      await softDeleteItem(bookId)
      setDeleteTarget(null)
      loadBooks()
    } catch (err) {
      console.error('Soft delete failed:', err)
      alert('Failed to mark book as previously owned')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleHardDelete(bookId: string) {
    try {
      setIsDeleting(true)
      await hardDeleteItem(bookId)
      setDeleteTarget(null)
      loadBooks()
    } catch (err) {
      console.error('Hard delete failed:', err)
      alert('Failed to delete book')
    } finally {
      setIsDeleting(false)
    }
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
          {searchQuery
            ? `${activeBooks.length} book${activeBooks.length !== 1 ? 's' : ''} found`
            : totalCount > activeBooks.length
              ? `Showing ${activeBooks.length} of ${totalCount.toLocaleString()} book${totalCount !== 1 ? 's' : ''} in your collection`
              : `${totalCount.toLocaleString()} book${totalCount !== 1 ? 's' : ''} in your collection`}
          {previouslyOwned.length > 0 && (
            <button
              onClick={() => setShowPreviouslyOwned(!showPreviouslyOwned)}
              style={{
                marginLeft: '1rem', padding: '0.2rem 0.6rem', borderRadius: '12px',
                border: '1px solid #d1d5db', fontSize: '0.8rem', cursor: 'pointer',
                backgroundColor: showPreviouslyOwned ? '#fef3c7' : '#f8fafc',
                color: showPreviouslyOwned ? '#92400e' : '#64748b', fontWeight: 500,
              }}
            >
              📦 {previouslyOwned.length} previously owned {showPreviouslyOwned ? '(showing)' : ''}
            </button>
          )}
          {enrichmentFilter !== 'all' && (
            <button
              onClick={() => setEnrichmentFilter('all')}
              style={{
                marginLeft: '0.5rem', padding: '0.2rem 0.6rem', borderRadius: '12px',
                border: '1px solid #d1d5db', fontSize: '0.8rem', cursor: 'pointer',
                backgroundColor: enrichmentFilter === 'enriched' ? '#dcfce7' : '#fef2f2',
                color: enrichmentFilter === 'enriched' ? '#16a34a' : '#dc2626',
                fontWeight: 500,
              }}
              title="Click to clear filter"
            >
              ✦ {enrichmentFilter === 'enriched' ? 'Enriched' : 'Unenriched'} ✕
            </button>
          )}
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, author, ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingRight: '2.5rem' }}
          />
          {isSearching && (
            <span style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              fontSize: '0.85rem', color: '#94a3b8', animation: 'spin 1s linear infinite',
            }}>⟳</span>
          )}
          {!isSearching && searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1rem', color: '#94a3b8', padding: 0, lineHeight: 1,
              }}
              title="Clear search"
            >✕</button>
          )}
        </div>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => {
            if (viewMode === 'list') setViewMode('grid')
            else if (viewMode === 'grid') setViewMode('catalog')
            else setViewMode('list')
          }}
        >
          {viewMode === 'list' ? '📋 List' : viewMode === 'grid' ? '📚 Grid' : '📇 Catalog'}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Display
        </button>
        {selectionMode ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSelectionMode(false)
              setSelectedBookIds(new Set())
            }}
            style={{ backgroundColor: '#ecfdf5', borderColor: '#10b981', color: '#059669' }}
          >
            ✕ Cancel
          </button>
        ) : (
          <div ref={toolsMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowToolsMenu(!showToolsMenu)}
            >
              🛠 Tools ▾
            </button>
            {showToolsMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50,
                backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0', minWidth: '220px', overflow: 'hidden',
              }}>
                <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Maintenance
                </div>
                <button
                  onClick={() => { setShowToolsMenu(false); setSelectionMode(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                    padding: '0.6rem 0.75rem', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#334155',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span>✦</span> Enrich Books
                </button>
                <button
                  onClick={() => { setShowToolsMenu(false); navigate('/duplicates') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                    padding: '0.6rem 0.75rem', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#334155',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span>🔄</span> Review Duplicates
                </button>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Filter by Enrichment
                </div>
                {(['all', 'unenriched', 'enriched'] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => { setEnrichmentFilter(val); setShowToolsMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                      padding: '0.5rem 0.75rem', border: 'none', background: enrichmentFilter === val ? '#f0fdf4' : 'none',
                      cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left',
                      color: enrichmentFilter === val ? '#16a34a' : '#334155',
                      fontWeight: enrichmentFilter === val ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (enrichmentFilter !== val) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = enrichmentFilter === val ? '#f0fdf4' : 'transparent' }}
                  >
                    {enrichmentFilter === val ? '●' : '○'} {val === 'all' ? 'All Books' : val === 'enriched' ? 'Enriched Only' : 'Unenriched Only'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Batch selection toolbar */}
      {selectionMode && (
        <div style={{
          backgroundColor: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '8px',
          marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          border: '1px solid #bfdbfe',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={displayedBooks.length > 0 && selectedBookIds.size === displayedBooks.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedBookIds(new Set(displayedBooks.map(b => b.id)))
                } else {
                  setSelectedBookIds(new Set())
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 500, color: '#1e40af' }}>Select All</span>
          </label>
          <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
            {selectedBookIds.size} of {displayedBooks.length} selected
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                if (selectedBookIds.size === 0) {
                  alert('Select at least one book to enrich.')
                  return
                }
                const ids = Array.from(selectedBookIds).join(',')
                navigate(`/enrich?ids=${ids}`)
              }}
              disabled={selectedBookIds.size === 0}
              style={{
                padding: '0.4rem 1rem', borderRadius: '6px', border: 'none',
                backgroundColor: selectedBookIds.size === 0 ? '#cbd5e1' : '#10b981',
                color: 'white', fontSize: '0.85rem', fontWeight: 600,
                cursor: selectedBookIds.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              🔍 Enrich Selected ({selectedBookIds.size})
            </button>
            <button
              onClick={() => {
                // Select all and navigate
                const allIds = displayedBooks.map(b => b.id).join(',')
                navigate(`/enrich?ids=${allIds}`)
              }}
              disabled={displayedBooks.length === 0}
              style={{
                padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid #10b981',
                backgroundColor: 'white', color: '#059669', fontSize: '0.85rem', fontWeight: 600,
                cursor: displayedBooks.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              🔍 Enrich All ({displayedBooks.length})
            </button>
          </div>
        </div>
      )}

      {/* Display Settings */}
      {showSettings && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          maxHeight: '60vh',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              Display Fields ({displayFields.length} selected)
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setDisplayFields(DEFAULT_DISPLAY_FIELDS)}
              >
                Reset to Default
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setDisplayFields([])}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Search filter for fields */}
          <input
            type="text"
            placeholder="Search fields..."
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              outline: 'none',
            }}
          />

          {/* Currently selected fields (reorderable summary) */}
          {displayFields.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 500 }}>
                Active columns (in order):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {displayFields.map((key) => {
                  const def = ALL_DISPLAY_FIELDS.find(f => f.key === key)
                  return (
                    <span
                      key={key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 9999,
                      }}
                    >
                      {def?.label ?? key}
                      <button
                        onClick={() => setDisplayFields(displayFields.filter(f => f !== key))}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#1e40af',
                          fontSize: '0.85rem',
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Field categories */}
          {FIELD_CATEGORIES
            .filter(cat => {
              const fieldsInCat = ALL_DISPLAY_FIELDS.filter(f => f.category === cat.key)
              if (fieldsInCat.length === 0) return false
              if (!fieldSearch.trim()) return true
              const q = fieldSearch.toLowerCase()
              return fieldsInCat.some(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q))
            })
            .map(cat => {
              const fieldsInCat = ALL_DISPLAY_FIELDS
                .filter(f => f.category === cat.key)
                .filter(f => {
                  if (!fieldSearch.trim()) return true
                  const q = fieldSearch.toLowerCase()
                  return f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
                })
              const selectedInCat = fieldsInCat.filter(f => displayFields.includes(f.key)).length
              const isExpanded = expandedCategories.has(cat.key) || fieldSearch.trim().length > 0

              return (
                <div key={cat.key} style={{ marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const next = new Set(expandedCategories)
                      if (next.has(cat.key)) next.delete(cat.key)
                      else next.add(cat.key)
                      setExpandedCategories(next)
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.5rem',
                      background: selectedInCat > 0 ? '#f0f9ff' : '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#334155',
                      textAlign: 'left' as const,
                    }}
                  >
                    <span>{isExpanded ? '▼' : '▶'}</span>
                    <span>{cat.icon} {cat.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
                      {selectedInCat}/{fieldsInCat.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem 1rem',
                      padding: '0.5rem 0.75rem 0.5rem 1.75rem',
                    }}>
                      {fieldsInCat.map(field => (
                        <label
                          key={field.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            minWidth: '140px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={displayFields.includes(field.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDisplayFields([...displayFields, field.key])
                              } else {
                                setDisplayFields(displayFields.filter(f => f !== field.key))
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

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

      {!isLoading && !error && displayedBooks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          {showPreviouslyOwned 
            ? <p>No previously owned books.</p>
            : searchQuery
              ? <><p>No books matching your search.</p><p>Try a different search term.</p></>
              : <><p>No books in your library yet.</p><p>Add your first book to get started!</p></>
          }
        </div>
      )}

      {!isLoading && !error && displayedBooks.length > 0 && (
        <>
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {displayedBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => {
                    if (selectionMode) {
                      const next = new Set(selectedBookIds)
                      if (next.has(book.id)) next.delete(book.id)
                      else next.add(book.id)
                      setSelectedBookIds(next)
                    } else {
                      navigate(`/book/${book.id}`)
                    }
                  }}
                  style={{
                    backgroundColor: selectionMode && selectedBookIds.has(book.id) ? '#eff6ff' : showPreviouslyOwned ? '#fffbeb' : 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    border: selectionMode && selectedBookIds.has(book.id) ? '2px solid #3b82f6' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Selection checkbox */}
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedBookIds.has(book.id)}
                      onChange={() => {}} // handled by row click
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: 'pointer', flexShrink: 0, width: '18px', height: '18px' }}
                    />
                  )}
                  {/* Cover thumbnail */}
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
                          // Replace with placeholder on final failure
                          const parent = img.parentElement
                          if (parent) {
                            const placeholder = document.createElement('div')
                            placeholder.style.cssText = 'width:50px;height:75px;border-radius:4px;flex-shrink:0;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.6rem;text-align:center;line-height:1.2'
                            placeholder.textContent = 'No Cover'
                            parent.replaceChild(placeholder, img)
                          }
                        }
                      }}
                      style={{
                        width: '50px',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '50px',
                      height: '75px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '0.6rem',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}>
                      No Cover
                    </div>
                  )}
                  
                  {/* Title - always shown */}
                  <div style={{ 
                    flex: '1 1 300px',
                    minWidth: 0
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '0.25rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</span>
                      {book.enrichedAt && (
                        <span
                          title={`Enriched ${new Date(book.enrichedAt).toLocaleDateString()}${book.enrichmentSources?.length ? ' via ' + book.enrichmentSources.join(', ') : ''}`}
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            lineHeight: 1,
                            padding: '2px 5px',
                            borderRadius: '9999px',
                            backgroundColor: '#dcfce7',
                            color: '#16a34a',
                            letterSpacing: '0.02em',
                          }}
                        >
                          ✦ enriched
                        </span>
                      )}
                    </div>
                    {book.subtitle && (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {book.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Configurable fields */}
                  {displayFields.map(fieldKey => {
                    const value = (book as any)[fieldKey]
                    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null
                    
                    const fieldDef = ALL_DISPLAY_FIELDS.find(f => f.key === fieldKey)
                    const fieldLabel = fieldDef?.label || fieldKey
                    let displayValue: string
                    if (Array.isArray(value)) {
                      displayValue = value.map(v => typeof v === 'object' ? (v.text || v.name || JSON.stringify(v)) : v).join(', ')
                    } else if (typeof value === 'boolean') {
                      displayValue = value ? 'Yes' : 'No'
                    } else if (typeof value === 'object') {
                      displayValue = JSON.stringify(value)
                    } else {
                      displayValue = String(value)
                    }
                    
                    return (
                      <div 
                        key={fieldKey}
                        style={{
                          flex: '0 0 auto',
                          minWidth: '150px',
                          maxWidth: '200px'
                        }}
                      >
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '0.125rem'
                        }}>
                          {fieldLabel}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#475569',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {displayValue}
                        </div>
                      </div>
                    )
                  })}

                  {/* Trash icon — stop propagation so click doesn't navigate */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: book.id, title: book.title }) }}
                    title="Remove book"
                    style={{
                      flexShrink: 0, width: '32px', height: '32px', borderRadius: '6px',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem', opacity: 0.3, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="book-grid">
              {displayedBooks.map((book) => (
                <div key={book.id} onClick={() => navigate(`/book/${book.id}`)} style={{ cursor: 'pointer' }}>
                  <BookCard book={book} displayFields={displayFields} />
                </div>
              ))}
            </div>
          )}

          {viewMode === 'catalog' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              alignItems: 'center',
            }}>
              {displayedBooks.map((book) => (
                <div key={book.id} onClick={() => navigate(`/book/${book.id}`)} style={{ cursor: 'pointer' }}>
                  <CardCatalogView book={book} displayFields={displayFields} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setDeleteTarget(null)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Remove "{deleteTarget.title}"?
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Choose how you'd like to handle this book:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleSoftDelete(deleteTarget.id)}
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
                  Keep the record but mark it as no longer in your collection.
                </div>
              </button>

              <button
                onClick={() => handleHardDelete(deleteTarget.id)}
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
                  Remove the book completely. This cannot be undone.
                </div>
              </button>

              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: '#64748b',
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

export default LibraryPage
