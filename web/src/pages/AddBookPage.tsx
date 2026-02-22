import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import BookSelectionModal from '../components/BookSelectionModal'
import { searchBook, searchBookMultiple, Book, type SearchHints } from '../api/books'
import { createBook, mapBookToIngestRequest, getDedupIndex, normalizeTitle, getHouseholdLocations, IdentifierType, ContributorRole, SubjectScheme, type CreateBookIngestRequest } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'
import { 
  FIELD_CATEGORIES, 
  FIELD_DEFINITIONS, 
  DEFAULT_MAIN_FIELDS,
  getFieldsByCategory,
  type FieldConfig,
  type CategoryKey 
} from '../config/field-config'

// Fields that contribute to search refinement — shown in hints panel before a book is populated
const SEARCH_HINT_FIELD_KEYS: string[] = [
  'publisher', 'placeOfPublication', 'publishedDate', 'language', 'categories',
]

function AddBookPage() {
  const navigate = useNavigate()
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const [showScanner, setShowScanner] = useState(false)
  const [showBookSelection, setShowBookSelection] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<Partial<Book> & { isbn?: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number; apiName: string } | null>(null)
  const [showRefinements, setShowRefinements] = useState(false)
  const [knownLocations, setKnownLocations] = useState<string[]>([])
  
  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(
    new Set(['basic']) // Basic category expanded by default
  )
  
  // Duplicate warning
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<string[]>([])
  
  // Custom fields
  const [customFields, setCustomFields] = useState<Record<string, any>>({})
  const [newCustomFieldName, setNewCustomFieldName] = useState('')
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('')
  
  // Form state - initialize with all possible fields
  const [formData, setFormData] = useState<Partial<Book>>({
    title: '',
    author: '',
    isbn: '',
    description: '',
    publisher: '',
    publishedDate: '',
    pageCount: undefined,
    coverImageUrl: '',
    language: 'en',
    subtitle: '',
    customFields: {},
  })

  // Derived: whether a book has been populated from search results
  const isBookPopulated = !!(formData.title && (formData.title as string).trim())

  useEffect(() => {
    if (selectedHousehold) {
      getHouseholdLocations(selectedHousehold.id)
        .then(setKnownLocations)
        .catch(() => {})
    }
  }, [selectedHousehold])

  async function handleSearch(query: string) {
    setIsLoading(true)
    setError(null)
    setSearchProgress({ current: 0, total: 3, apiName: 'Starting search...' })
    
    try {
      // Auto-gather filled form fields as search hints
      const hints: SearchHints = {}
      if (formData.publisher) hints.publisher = formData.publisher as string
      if ((formData as any).placeOfPublication) hints.place = (formData as any).placeOfPublication
      if (formData.publishedDate) hints.year = String(formData.publishedDate).slice(0, 4)
      if (formData.language && formData.language !== 'en') hints.language = formData.language as string
      if (formData.categories && formData.categories.length > 0) hints.subject = (formData.categories as string[])[0]

      const hasHints = Object.keys(hints).length > 0
      if (hasHints) console.log('🔎 Auto-detected form hints:', hints)

      // Use multiple results search with form hints
      const results = await searchBookMultiple(query, (current, total, status) => {
        setSearchProgress({ current, total, apiName: status })
      }, hasHints ? hints : undefined)

      if (results && results.length > 0) {
        if (results.length === 1) {
          // Only one result, use it directly
          setFormData(results[0])
          setSearchInput('')
          if (results[0].customFields) {
            setCustomFields(results[0].customFields)
          }
        } else {
          // Multiple results, show selection modal
          setSearchResults(results)
          setShowBookSelection(true)
        }
      } else {
        setError('No books found. Please try a different search or enter details manually.')
        setSearchInput('')
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to search. Please try again.'
      setError(errorMsg)
      console.error('Search error:', err)
      console.error('Error details:', err?.stack)
    } finally {
      setIsLoading(false)
      setSearchProgress(null)
    }
  }

  function handleBookSelected(book: Partial<Book> & { isbn?: string }) {
    setFormData(book)
    setShowBookSelection(false)
    setSearchResults([])
    setSearchInput('')
    if (book.customFields) {
      setCustomFields(book.customFields)
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchInput.trim()) {
      handleSearch(searchInput.trim())
    }
  }

  function handleInputChange(field: keyof Book, value: any) {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  function handleArrayFieldChange(field: keyof Book, value: string) {
    const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0)
    setFormData({
      ...formData,
      [field]: items,
    })
  }

  function toggleCategory(category: CategoryKey) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function expandAll() {
    setExpandedCategories(new Set(FIELD_CATEGORIES.map(c => c.key)))
  }

  function collapseAll() {
    setExpandedCategories(new Set(['basic']))
  }

  function addCustomField() {
    if (newCustomFieldName.trim()) {
      setCustomFields({
        ...customFields,
        [newCustomFieldName.trim()]: newCustomFieldValue,
      })
      setNewCustomFieldName('')
      setNewCustomFieldValue('')
    }
  }

  function removeCustomField(fieldName: string) {
    const updated = { ...customFields }
    delete updated[fieldName]
    setCustomFields(updated)
  }

  async function saveBook() {
    if (!selectedHousehold) return
    setIsLoading(true)
    setError(null)
    try {
      const finalData = {
        ...formData,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      }
      const bookRequest = mapBookToIngestRequest(finalData)
      await createBook(bookRequest, selectedHousehold.id)
      navigate('/library')
    } catch (err) {
      setError('Failed to add book. Is the backend API running on port 5259?')
      console.error('Failed to add book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedHousehold) {
      setError('No household selected. Please select a library from the dropdown.')
      return
    }

    if (!formData.title || !formData.author) {
      setError('Title and Author are required')
      return
    }

    // Check for duplicates before saving
    try {
      const index = await getDedupIndex(selectedHousehold.id)
      const matches: string[] = []

      // Check title match
      const normTitle = normalizeTitle(formData.title as string)
      if (index.normalizedTitles.includes(normTitle)) {
        matches.push(`Title "${formData.title}" already exists in your library`)
      }

      // Check ISBN matches
      const isbn10 = (formData as any).isbn10 || (formData as any).isbn || ''
      const isbn13 = (formData as any).isbn13 || ''
      if (isbn10 && index.identifiers.includes(isbn10)) {
        matches.push(`ISBN ${isbn10} already exists in your library`)
      }
      if (isbn13 && isbn13 !== isbn10 && index.identifiers.includes(isbn13)) {
        matches.push(`ISBN ${isbn13} already exists in your library`)
      }

      if (matches.length > 0) {
        setDuplicateMatches(matches)
        setShowDuplicateWarning(true)
        return
      }
    } catch (err) {
      // If dedup check fails, proceed with save anyway
      console.warn('Duplicate check failed, proceeding with save:', err)
    }

    await saveBook()
  }

  function handleCancel() {
    navigate('/library')
  }

  // Render a single field based on its configuration
  function renderField(fieldConfig: FieldConfig) {
    const value = formData[fieldConfig.key]
    const isRequired = fieldConfig.required
    
    return (
      <div key={fieldConfig.key} style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
          {fieldConfig.label} 
          {isRequired && <span style={{ color: '#dc2626' }}> *</span>}
          {fieldConfig.source && (
            <span style={{ 
              marginLeft: '0.5rem', 
              fontSize: '0.75rem', 
              color: '#64748b',
              fontWeight: 'normal'
            }}>
              ({fieldConfig.source})
            </span>
          )}
        </label>
        {fieldConfig.description && (
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
            {fieldConfig.description}
          </p>
        )}
        
        {fieldConfig.type === 'textarea' ? (
          <textarea
            className="search-input"
            value={value as string || ''}
            onChange={(e) => handleInputChange(fieldConfig.key, e.target.value)}
            rows={3}
            placeholder={fieldConfig.placeholder}
            style={{ resize: 'vertical', fontSize: '0.9rem' }}
            required={isRequired}
          />
        ) : fieldConfig.type === 'number' ? (
          <input
            type="number"
            className="search-input"
            value={value as number || ''}
            onChange={(e) => handleInputChange(fieldConfig.key, parseFloat(e.target.value) || undefined)}
            placeholder={fieldConfig.placeholder}
            style={{ fontSize: '0.9rem' }}
            required={isRequired}
          />
        ) : fieldConfig.type === 'boolean' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => handleInputChange(fieldConfig.key, e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            <span style={{ fontSize: '0.9rem' }}>Yes</span>
          </div>
        ) : fieldConfig.type === 'array' ? (
          <div>
            <input
              type="text"
              className="search-input"
              value={Array.isArray(value) ? value.join(', ') : ''}
              onChange={(e) => handleArrayFieldChange(fieldConfig.key, e.target.value)}
              placeholder={fieldConfig.placeholder || 'Comma-separated values'}
              style={{ fontSize: '0.9rem' }}
            />
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
              Separate multiple values with commas
            </p>
          </div>
        ) : (fieldConfig.key === 'location' || fieldConfig.key === 'pln') && knownLocations.length > 0 ? (
          <>
            <input
              type="text"
              className="search-input"
              list={`add-datalist-${fieldConfig.key}`}
              value={value as string || ''}
              onChange={(e) => handleInputChange(fieldConfig.key, e.target.value)}
              placeholder={fieldConfig.placeholder || 'Select or type a location'}
              style={{ fontSize: '0.9rem' }}
              required={isRequired}
            />
            <datalist id={`add-datalist-${fieldConfig.key}`}>
              {knownLocations.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </>
        ) : (
          <input
            type={fieldConfig.type}
            className="search-input"
            value={value as string || ''}
            onChange={(e) => handleInputChange(fieldConfig.key, e.target.value)}
            placeholder={fieldConfig.placeholder}
            style={{ fontSize: '0.9rem' }}
            required={isRequired}
          />
        )}
      </div>
    )
  }

  // Render a category section
  function renderCategory(category: CategoryKey) {
    const categoryConfig = FIELD_CATEGORIES.find(c => c.key === category)
    if (!categoryConfig) return null
    
    let fields = getFieldsByCategory(category)

    // When search hints panel is visible, hide hint fields from their normal categories
    if (!isBookPopulated) {
      fields = fields.filter(f => !SEARCH_HINT_FIELD_KEYS.includes(f.key))
    }

    if (fields.length === 0) return null
    
    const isExpanded = expandedCategories.has(category)
    const hasData = fields.some(field => {
      const value = formData[field.key]
      return value !== undefined && value !== '' && value !== null
    })
    
    return (
      <div 
        key={category}
        style={{
          marginBottom: '1rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: hasData ? '#f0fdf4' : 'white',
        }}
      >
        <button
          type="button"
          onClick={() => toggleCategory(category)}
          style={{
            width: '100%',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isExpanded ? '#f8fafc' : 'white',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{categoryConfig.icon}</span>
            <div>
              <div>{categoryConfig.label}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                {categoryConfig.description}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {hasData && (
              <span style={{ 
                fontSize: '0.75rem', 
                backgroundColor: '#10b981', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '12px' 
              }}>
                Has Data
              </span>
            )}
            <span style={{ fontSize: '1.25rem' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </button>
        
        {isExpanded && (
          <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
            {fields.map(field => renderField(field))}
          </div>
        )}
      </div>
    )
  }

  // Show loading state while households are loading
  if (isLoadingHousehold) {
    return (
      <div className="page-header">
        <h1 className="page-title">Add New Book</h1>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading households...
        </div>
      </div>
    )
  }

  // Show error if no household selected
  if (!selectedHousehold) {
    return (
      <div className="page-header">
        <h1 className="page-title">Add New Book</h1>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          margin: '2rem 0',
        }}>
          <p style={{ marginBottom: '1rem' }}>
            ⚠️ No household/library found. Please create one first.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="btn btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Add New Book</h1>
        <p className="page-subtitle">
          Scan a barcode, search by ISBN, or fill out manually
        </p>
      </div>

      {/* ===== Unified Search Section ===== */}
      <form onSubmit={handleSearchSubmit} style={{
        marginBottom: '2rem',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {/* ── Search Input ── */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          backgroundColor: '#f8fafc',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <span>🔍</span>
            <span>Search</span>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="ISBN, title, or 'Title by Author'"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
            Examples: "9780143127741" or "Body Keeps Score" or "Sapiens by Yuval Noah Harari"
          </p>
        </div>

        {/* ── Refinements (collapsible) ── visible only before a book is populated */}
        {!isBookPopulated && (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setShowRefinements(prev => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                backgroundColor: '#fffdf5',
                border: 'none',
                cursor: 'pointer',
                borderBottom: showRefinements ? '1px solid #fde68a' : 'none',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#92400e',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <span>🎯</span>
                <span>Refinements</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, fontStyle: 'italic', color: '#a16207', textTransform: 'none', letterSpacing: 'normal' }}>
                  — optional, auto-applied to search
                </span>
              </div>
              <span style={{ fontSize: '1rem', color: '#92400e', transition: 'transform 0.2s', transform: showRefinements ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </button>
            {showRefinements && (
              <div style={{
                padding: '1rem 1.25rem',
                backgroundColor: '#fffdf5',
              }}>
                <div className="two-col-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: '#78350f' }}>
                      Publisher
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      value={formData.publisher as string || ''}
                      onChange={(e) => handleInputChange('publisher', e.target.value)}
                      placeholder="e.g., Oxford University Press"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: '#78350f' }}>
                      Place of Publication
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      value={(formData as any).placeOfPublication || ''}
                      onChange={(e) => handleInputChange('placeOfPublication', e.target.value)}
                      placeholder="e.g., London, New York"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: '#78350f' }}>
                      Year Published
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      value={formData.publishedDate as string || ''}
                      onChange={(e) => handleInputChange('publishedDate', e.target.value)}
                      placeholder="e.g., 1965"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: '#78350f' }}>
                      Language
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      value={formData.language as string || ''}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      placeholder="e.g., en, es, fr"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: '#78350f' }}>
                      Subject / Category
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      value={Array.isArray(formData.categories) ? (formData.categories as string[]).join(', ') : ''}
                      onChange={(e) => handleArrayFieldChange('categories', e.target.value)}
                      placeholder="e.g., Church History, Theology"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="search-action-buttons" style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'stretch',
          padding: '1rem 1.25rem',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          flexWrap: 'wrap',
        }}>
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={isLoading || !searchInput.trim()}
            style={{ flex: 1 }}
          >
            {isLoading ? 'Searching...' : '🔍 Search Book'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({
                title: '',
                author: '',
                isbn: '',
                description: '',
                publisher: '',
                publishedDate: '',
                pageCount: undefined,
                coverImageUrl: '',
                language: 'en',
                subtitle: '',
                customFields: {},
              })
              setCustomFields({})
              setSearchInput('')
              setError(null)
            }}
            className="btn"
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '0.75rem 1.25rem',
            }}
          >
            🗑️ Clear
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 1.25rem',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>📷</span>
            <span>Scan Barcode</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
        }}>
          {error}
        </div>
      )}

      {/* Progress Bar */}
      {searchProgress && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#e3f2fd',
          border: '1px solid #90caf9',
          borderRadius: '4px',
        }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Searching APIs ({searchProgress.current}/{searchProgress.total})
          </div>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            {searchProgress.apiName}
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#ddd',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(searchProgress.current / searchProgress.total) * 100}%`,
              height: '100%',
              backgroundColor: '#2196f3',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Data Sources Info */}
      {formData.dataSources && formData.dataSources.length > 0 && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#dbeafe',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          color: '#1e40af',
          fontSize: '0.875rem',
        }}>
          <strong>✓ Book data loaded from:</strong> {formData.dataSources.join(', ')}
        </div>
      )}

      {/* Cover Image Preview */}
      {formData.coverImageUrl && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <img
            src={formData.coverImageUrl}
            alt="Book cover"
            style={{
              maxWidth: '200px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
        </div>
      )}

      {/* Book Form with Collapsible Categories */}
      <form id="add-book-form" onSubmit={handleSubmit} className="card" style={{ maxWidth: 'none' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h2 style={{ margin: 0 }}>Book Details</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={expandAll}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Render all categories */}
        {FIELD_CATEGORIES.map(category => renderCategory(category.key))}

        {/* Custom Fields Section */}
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          border: '2px dashed #cbd5e1',
          borderRadius: '8px',
          backgroundColor: '#f8fafc',
        }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✨</span> Custom Fields
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Add your own custom fields to track additional information specific to your needs.
          </p>
          
          {Object.entries(customFields).map(([fieldName, fieldValue]) => (
            <div key={fieldName} style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              marginBottom: '0.5rem',
              alignItems: 'center',
              backgroundColor: 'white',
              padding: '0.5rem',
              borderRadius: '4px',
            }}>
              <strong style={{ minWidth: '150px' }}>{fieldName}:</strong>
              <span style={{ flex: 1 }}>{String(fieldValue)}</span>
              <button
                type="button"
                onClick={() => removeCustomField(fieldName)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Field name"
              value={newCustomFieldName}
              onChange={(e) => setNewCustomFieldName(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <input
              type="text"
              placeholder="Field value"
              value={newCustomFieldValue}
              onChange={(e) => setNewCustomFieldValue(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <button
              type="button"
              onClick={addCustomField}
              disabled={!newCustomFieldName.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: newCustomFieldName.trim() ? '#10b981' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: newCustomFieldName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Spacer so content isn't hidden behind the sticky bar */}
        <div style={{ height: '5rem' }} />
      </form>

      {/* Sticky Action Bar – always visible at bottom of viewport */}
      <div className="sticky-action-bar">
        <button
          type="submit"
          form="add-book-form"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ flex: 1 }}
        >
          {isLoading ? 'Adding...' : 'Add Book'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Book Selection Modal */}
      {showBookSelection && searchResults.length > 0 && (
        <BookSelectionModal
          books={searchResults}
          onSelect={handleBookSelected}
          onClose={() => {
            setShowBookSelection(false)
            setSearchResults([])
          }}
        />
      )}

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#92400e', fontSize: '1.1rem' }}>Possible Duplicate</h3>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              This book may already be in your library:
            </p>
            <ul style={{ margin: '0 0 1.5rem 0', padding: '0 0 0 1.25rem' }}>
              {duplicateMatches.map((match, i) => (
                <li key={i} style={{ color: '#b45309', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  {match}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDuplicateWarning(false)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid #d1d5db',
                  background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false)
                  saveBook()
                }}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid #f59e0b',
                  background: '#fef3c7', color: '#92400e', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Add Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddBookPage
