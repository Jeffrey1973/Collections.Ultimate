import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard.tsx'
import CardCatalogView from '../components/CardCatalogView.tsx'
import { Book } from '../api/books'
import { getItems, getHouseholdLocations, mapSearchResultToBook, softDeleteItem, hardDeleteItem } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'
import { FIELD_DEFINITIONS, FIELD_CATEGORIES, type CategoryKey } from '../config/field-config'

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [catalogPopoverId, setCatalogPopoverId] = useState<string | null>(null)
  const catalogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPreviouslyOwned, setShowPreviouslyOwned] = useState(false)
  const [enrichmentFilter, setEnrichmentFilter] = useState<'all' | 'enriched' | 'unenriched'>('all')
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [displayFields, setDisplayFields] = useState<string[]>(loadSavedFields)
  const [fieldSearch, setFieldSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Filter panel state
  const [showFilters, setShowFilters] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  // Count active filters for badge
  const activeFilterCount = [
    enrichmentFilter !== 'all',
    verifiedFilter !== 'all',
    locationFilter !== '',
    statusFilter !== '',
    tagFilter.trim() !== '',
    subjectFilter.trim() !== '',
  ].filter(Boolean).length

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

  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (selectedHousehold) {
      initialLoadDone.current = true
      loadBooks()
      // Load locations for filter dropdown
      getHouseholdLocations(selectedHousehold.id)
        .then(setLocations)
        .catch(() => setLocations([]))
    }
  }, [selectedHousehold])

  // Debounced search: fires 300ms after the user stops typing
  useEffect(() => {
    if (!selectedHousehold || !initialLoadDone.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      loadBooks()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  // Reload when server-side filters change
  useEffect(() => {
    if (selectedHousehold && initialLoadDone.current) loadBooks()
  }, [enrichmentFilter, verifiedFilter, locationFilter, statusFilter])

  async function loadBooks() {
    if (!selectedHousehold) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Build server-side filter params
      const verified = verifiedFilter === 'verified' ? 'true' : verifiedFilter === 'unverified' ? 'false' : undefined
      const enriched = enrichmentFilter === 'enriched' ? 'true' : enrichmentFilter === 'unenriched' ? 'false' : undefined
      const result = await getItems(selectedHousehold.id, { 
        q: searchQuery || undefined,
        verified,
        enriched,
        locationId: locationFilter || undefined,
        status: statusFilter || undefined,
        tag: tagFilter.trim() || undefined,
        subject: subjectFilter.trim() || undefined,
        take: 500,
      })
      
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

  // Filter books based on ownership status (Previously Owned/Deleted are client-side; enriched/verified are server-side)
  const activeBooks = books.filter(b => (b as any).status !== 'Previously Owned' && (b as any).status !== 'Deleted')
  const previouslyOwned = books.filter(b => (b as any).status === 'Previously Owned')
  const displayedBooks = showPreviouslyOwned ? previouslyOwned : activeBooks

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
          {activeFilterCount > 0 && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
              ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)
            </span>
          )}
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
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          {viewMode === 'list' ? '📋 List' : '📚 Grid'}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Display
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowFilters(!showFilters)}
          style={{
            position: 'relative',
            backgroundColor: activeFilterCount > 0 ? '#eff6ff' : undefined,
            borderColor: activeFilterCount > 0 ? '#93c5fd' : undefined,
            color: activeFilterCount > 0 ? '#2563eb' : undefined,
          }}
        >
          🔍 Filters{activeFilterCount > 0 && (
            <span style={{
              position: 'absolute', top: '-6px', right: '-6px',
              width: '18px', height: '18px', borderRadius: '50%',
              backgroundColor: '#2563eb', color: 'white',
              fontSize: '0.65rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{activeFilterCount}</span>
          )}
        </button>
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
                  onClick={() => { setShowToolsMenu(false); navigate('/enrich') }}
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
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Filter by Verification
                </div>
                {(['all', 'unverified', 'verified'] as const).map((val) => (
                  <button
                    key={`v-${val}`}
                    onClick={() => { setVerifiedFilter(val); setShowToolsMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                      padding: '0.5rem 0.75rem', border: 'none', background: verifiedFilter === val ? '#eff6ff' : 'none',
                      cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left',
                      color: verifiedFilter === val ? '#2563eb' : '#334155',
                      fontWeight: verifiedFilter === val ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (verifiedFilter !== val) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = verifiedFilter === val ? '#eff6ff' : 'transparent' }}
                  >
                    {verifiedFilter === val ? '●' : '○'} {val === 'all' ? 'All Books' : val === 'verified' ? 'Verified Only' : 'Unverified Only'}
                  </button>
                ))}
              </div>
            )}
          </div>
      </form>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.25rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', margin: 0 }}>
              🔍 Search Filters
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setEnrichmentFilter('all')
                  setVerifiedFilter('all')
                  setLocationFilter('')
                  setStatusFilter('')
                  setTagFilter('')
                  setSubjectFilter('')
                }}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '6px',
                  border: '1px solid #fca5a5', backgroundColor: '#fef2f2',
                  color: '#dc2626', fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* Location filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                📍 Location
              </label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                  border: `1px solid ${locationFilter ? '#93c5fd' : '#e2e8f0'}`,
                  fontSize: '0.85rem', backgroundColor: locationFilter ? '#eff6ff' : 'white',
                  color: '#334155', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">All Locations</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                📋 Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                  border: `1px solid ${statusFilter ? '#93c5fd' : '#e2e8f0'}`,
                  fontSize: '0.85rem', backgroundColor: statusFilter ? '#eff6ff' : 'white',
                  color: '#334155', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">All Statuses</option>
                <option value="Owned">Owned</option>
                <option value="Previously Owned">Previously Owned</option>
                <option value="Wishlist">Wishlist</option>
                <option value="On Loan">On Loan</option>
                <option value="Borrowed">Borrowed</option>
              </select>
            </div>

            {/* Enrichment filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                ✦ Enrichment
              </label>
              <select
                value={enrichmentFilter}
                onChange={(e) => setEnrichmentFilter(e.target.value as any)}
                style={{
                  width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                  border: `1px solid ${enrichmentFilter !== 'all' ? '#93c5fd' : '#e2e8f0'}`,
                  fontSize: '0.85rem', backgroundColor: enrichmentFilter !== 'all' ? '#eff6ff' : 'white',
                  color: '#334155', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="all">All</option>
                <option value="enriched">Enriched Only</option>
                <option value="unenriched">Unenriched Only</option>
              </select>
            </div>

            {/* Verification filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                ✓ Verification
              </label>
              <select
                value={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.value as any)}
                style={{
                  width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                  border: `1px solid ${verifiedFilter !== 'all' ? '#93c5fd' : '#e2e8f0'}`,
                  fontSize: '0.85rem', backgroundColor: verifiedFilter !== 'all' ? '#eff6ff' : 'white',
                  color: '#334155', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="all">All</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>

            {/* Tag filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                🏷️ Tag
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. fiction, classic..."
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      loadBooks()
                    }
                  }}
                  style={{
                    width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                    border: `1px solid ${tagFilter.trim() ? '#93c5fd' : '#e2e8f0'}`,
                    fontSize: '0.85rem', backgroundColor: tagFilter.trim() ? '#eff6ff' : 'white',
                    color: '#334155', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {tagFilter && (
                  <button
                    type="button"
                    onClick={() => { setTagFilter(''); loadBooks() }}
                    style={{
                      position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.85rem', color: '#94a3b8', padding: 0,
                    }}
                  >✕</button>
                )}
              </div>
            </div>

            {/* Subject filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                📚 Subject
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. history, science..."
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      loadBooks()
                    }
                  }}
                  style={{
                    width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px',
                    border: `1px solid ${subjectFilter.trim() ? '#93c5fd' : '#e2e8f0'}`,
                    fontSize: '0.85rem', backgroundColor: subjectFilter.trim() ? '#eff6ff' : 'white',
                    color: '#334155', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {subjectFilter && (
                  <button
                    type="button"
                    onClick={() => { setSubjectFilter(''); loadBooks() }}
                    style={{
                      position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.85rem', color: '#94a3b8', padding: 0,
                    }}
                  >✕</button>
                )}
              </div>
            </div>
          </div>

          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', margin: '0.75rem 0 0 0' }}>
            💡 Tip: Add filters to narrow results. Dropdowns apply instantly; press Enter for tag/subject text filters.
          </p>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Filters:</span>
          {locationFilter && (
            <button onClick={() => setLocationFilter('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              📍 {locations.find(l => l.id === locationFilter)?.name || 'Location'} ✕
            </button>
          )}
          {statusFilter && (
            <button onClick={() => setStatusFilter('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              📋 {statusFilter} ✕
            </button>
          )}
          {enrichmentFilter !== 'all' && (
            <button onClick={() => setEnrichmentFilter('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: enrichmentFilter === 'enriched' ? '#dcfce7' : '#fef2f2', color: enrichmentFilter === 'enriched' ? '#16a34a' : '#dc2626', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              ✦ {enrichmentFilter === 'enriched' ? 'Enriched' : 'Unenriched'} ✕
            </button>
          )}
          {verifiedFilter !== 'all' && (
            <button onClick={() => setVerifiedFilter('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: verifiedFilter === 'verified' ? '#dbeafe' : '#fef2f2', color: verifiedFilter === 'verified' ? '#2563eb' : '#dc2626', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              ✓ {verifiedFilter === 'verified' ? 'Verified' : 'Unverified'} ✕
            </button>
          )}
          {tagFilter.trim() && (
            <button onClick={() => { setTagFilter(''); loadBooks() }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              🏷️ {tagFilter} ✕
            </button>
          )}
          {subjectFilter.trim() && (
            <button onClick={() => { setSubjectFilter(''); loadBooks() }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              📚 {subjectFilter} ✕
            </button>
          )}
          <button
            onClick={() => {
              setEnrichmentFilter('all')
              setVerifiedFilter('all')
              setLocationFilter('')
              setStatusFilter('')
              setTagFilter('')
              setSubjectFilter('')
            }}
            style={{
              padding: '0.2rem 0.5rem', borderRadius: '12px',
              border: '1px solid #fca5a5', backgroundColor: '#fef2f2',
              color: '#dc2626', fontSize: '0.75rem', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
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
          {viewMode === 'list' && (() => {
            // Build grid template: cover + title + each display field + catalog icon + delete button
            const colCount = 2 + displayFields.length + 2 // cover, title, ...fields, catalog, delete
            const gridCols = `50px minmax(200px, 2fr) ${displayFields.map(() => 'minmax(100px, 1fr)').join(' ')} 32px 36px`
            
            // Helper to format a field value for display
            const formatValue = (value: any): string => {
              if (value === null || value === undefined || value === '') return '—'
              if (Array.isArray(value)) {
                if (value.length === 0) return '—'
                return value.map(v => typeof v === 'object' ? (v.text || v.name || JSON.stringify(v)) : v).join(', ')
              }
              if (typeof value === 'boolean') return value ? 'Yes' : 'No'
              if (typeof value === 'object') return JSON.stringify(value)
              return String(value)
            }

            return (
              <div style={{ overflowX: 'auto' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: '0',
                  minWidth: `${colCount * 120}px`,
                }}>
                  {/* Header row */}
                  <div style={{
                    display: 'contents',
                  }}>
                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }} />
                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>Title</div>
                    {displayFields.map(fieldKey => {
                      const fieldDef = ALL_DISPLAY_FIELDS.find(f => f.key === fieldKey)
                      return (
                        <div key={fieldKey} style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                          {fieldDef?.label || fieldKey}
                        </div>
                      )
                    })}
                    <div style={{ padding: '0.5rem 0.25rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }} />
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }} />
                  </div>

                  {/* Data rows */}
                  {displayedBooks.map((book) => (
                    <div
                      key={book.id}
                      className="library-list-row"
                      style={{ display: 'contents', cursor: 'pointer' }}
                      onClick={() => navigate(`/book/${book.id}`)}
                    >
                      {/* Cover */}
                      <div style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: showPreviouslyOwned ? '#fffbeb' : 'white' }}>
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
                                const parent = img.parentElement
                                if (parent) {
                                  const placeholder = document.createElement('div')
                                  placeholder.style.cssText = 'width:40px;height:56px;border-radius:3px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.5rem;text-align:center;line-height:1.2'
                                  placeholder.textContent = 'No Cover'
                                  parent.replaceChild(placeholder, img)
                                }
                              }
                            }}
                            style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '3px' }}
                          />
                        ) : (
                          <div style={{
                            width: '40px', height: '56px', borderRadius: '3px',
                            backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#94a3b8', fontSize: '0.5rem', textAlign: 'center', lineHeight: 1.2,
                          }}>No Cover</div>
                        )}
                      </div>

                      {/* Title + badges */}
                      <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: showPreviouslyOwned ? '#fffbeb' : 'white', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
                          {book.enrichedAt && (
                            <span title={`Enriched ${new Date(book.enrichedAt).toLocaleDateString()}`} style={{ flexShrink: 0, fontSize: '0.55rem', fontWeight: 700, padding: '1px 4px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#16a34a' }}>✦</span>
                          )}
                          {book.inventoryVerifiedDate && (
                            <span title={`Verified ${new Date(book.inventoryVerifiedDate).toLocaleDateString()}`} style={{ flexShrink: 0, fontSize: '0.55rem', fontWeight: 700, padding: '1px 4px', borderRadius: '9999px', backgroundColor: '#dbeafe', color: '#2563eb' }}>✓</span>
                          )}
                        </div>
                        {book.subtitle && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.subtitle}</div>
                        )}
                      </div>

                      {/* Display fields — always render every column for alignment */}
                      {displayFields.map(fieldKey => (
                        <div
                          key={fieldKey}
                          style={{
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: showPreviouslyOwned ? '#fffbeb' : 'white',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatValue((book as any)[fieldKey])}
                          </span>
                        </div>
                      ))}

                      {/* Catalog card icon */}
                      <div style={{ padding: '0.5rem 0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: showPreviouslyOwned ? '#fffbeb' : 'white', position: 'relative' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCatalogPopoverId(catalogPopoverId === book.id ? null : book.id) }}
                          onMouseEnter={(e) => {
                            e.stopPropagation()
                            if (catalogTimeoutRef.current) clearTimeout(catalogTimeoutRef.current)
                            setCatalogPopoverId(book.id)
                          }}
                          onMouseLeave={() => {
                            catalogTimeoutRef.current = setTimeout(() => setCatalogPopoverId(null), 300)
                          }}
                          title="View catalog card"
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', opacity: catalogPopoverId === book.id ? 1 : 0.35, transition: 'opacity 0.15s',
                          }}
                        >
                          📇
                        </button>
                        {catalogPopoverId === book.id && (
                          <div
                            onMouseEnter={() => { if (catalogTimeoutRef.current) clearTimeout(catalogTimeoutRef.current) }}
                            onMouseLeave={() => { catalogTimeoutRef.current = setTimeout(() => setCatalogPopoverId(null), 300) }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: '100%',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              zIndex: 100,
                              marginRight: '8px',
                              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))',
                              maxHeight: '80vh',
                              overflowY: 'auto',
                              borderRadius: '8px',
                            }}
                          >
                            <CardCatalogView book={book} displayFields={displayFields} />
                          </div>
                        )}
                      </div>

                      {/* Delete button */}
                      <div style={{ padding: '0.5rem 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: showPreviouslyOwned ? '#fffbeb' : 'white' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: book.id, title: book.title }) }}
                          title="Remove book"
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', opacity: 0.3, transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {viewMode === 'grid' && (
            <div className="book-grid">
              {displayedBooks.map((book) => (
                <div key={book.id} style={{ cursor: 'pointer', position: 'relative' }}>
                  <div onClick={() => navigate(`/book/${book.id}`)}>
                    <BookCard book={book} displayFields={displayFields} />
                  </div>
                  {/* Catalog card icon overlay */}
                  <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCatalogPopoverId(catalogPopoverId === book.id ? null : book.id) }}
                      onMouseEnter={(e) => {
                        e.stopPropagation()
                        if (catalogTimeoutRef.current) clearTimeout(catalogTimeoutRef.current)
                        setCatalogPopoverId(book.id)
                      }}
                      onMouseLeave={() => {
                        catalogTimeoutRef.current = setTimeout(() => setCatalogPopoverId(null), 300)
                      }}
                      title="View catalog card"
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: 'none', background: catalogPopoverId === book.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', opacity: catalogPopoverId === book.id ? 1 : 0.5,
                        transition: 'opacity 0.15s, background 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}
                    >
                      📇
                    </button>
                    {catalogPopoverId === book.id && (
                      <div
                        onMouseEnter={() => { if (catalogTimeoutRef.current) clearTimeout(catalogTimeoutRef.current) }}
                        onMouseLeave={() => { catalogTimeoutRef.current = setTimeout(() => setCatalogPopoverId(null), 300) }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 6px)',
                          zIndex: 100,
                          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))',
                          maxHeight: '80vh',
                          overflowY: 'auto',
                          borderRadius: '8px',
                        }}
                      >
                        <CardCatalogView book={book} displayFields={displayFields} />
                      </div>
                    )}
                  </div>
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
