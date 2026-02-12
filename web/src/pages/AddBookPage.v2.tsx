import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { searchBook, Book } from '../api/books'
import { createBook, IdentifierType, ContributorRole, SubjectScheme, type CreateBookIngestRequest } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'
import { 
  FIELD_CATEGORIES, 
  FIELD_DEFINITIONS, 
  DEFAULT_MAIN_FIELDS,
  getFieldsByCategory,
  type FieldConfig,
  type CategoryKey 
} from '../config/field-config'

function AddBookPage() {
  const navigate = useNavigate()
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const [showScanner, setShowScanner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number; apiName: string } | null>(null)
  
  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(
    new Set(['basic']) // Basic category expanded by default
  )
  
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

  async function handleSearch(query: string) {
    setIsLoading(true)
    setError(null)
    setSearchProgress({ current: 0, total: 3, apiName: 'Starting search...' })
    
    try {
      const bookInfo = await searchBook(query, (current, total, status) => {
        setSearchProgress({ current, total, apiName: status })
      })
      
      if (bookInfo) {
        setFormData(bookInfo)
        setSearchInput('')
        // Load custom fields if they exist
        if (bookInfo.customFields) {
          setCustomFields(bookInfo.customFields)
        }
      } else {
        setError('Book not found. Please enter details manually.')
        setSearchInput('')
      }
    } catch (err) {
      setError('Failed to search. Please try again.')
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
      setSearchProgress(null)
    }
  }

  function handleBarcodeScanned(isbn: string) {
    setShowScanner(false)
    handleSearch(isbn)
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

    setIsLoading(true)
    setError(null)

    try {
      // Include custom fields in the form data
      const finalData = {
        ...formData,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      }

      // Map frontend Book format to backend CreateBookIngestRequest format
      const bookRequest: CreateBookIngestRequest = {
        work: {
          title: finalData.title!,
          subtitle: finalData.subtitle,
          sortTitle: finalData.title,
          description: finalData.description,
        },
        edition: {
          editionTitle: finalData.title,
          editionSubtitle: finalData.subtitle,
          publisher: finalData.publisher,
          publishedYear: finalData.publishedDate ? parseInt(finalData.publishedDate.split('-')[0]) : undefined,
          pageCount: finalData.pageCount,
          description: finalData.description,
          identifiers: [
            ...(finalData.isbn13 ? [{
              identifierTypeId: IdentifierType.ISBN13,
              value: finalData.isbn13,
              isPrimary: true,
            }] : []),
            ...(finalData.isbn10 ? [{
              identifierTypeId: IdentifierType.ISBN10,
              value: finalData.isbn10,
              isPrimary: !finalData.isbn13,
            }] : []),
            ...(finalData.isbn && !finalData.isbn13 && !finalData.isbn10 ? [{
              identifierTypeId: finalData.isbn.length === 13 ? IdentifierType.ISBN13 : IdentifierType.ISBN10,
              value: finalData.isbn,
              isPrimary: true,
            }] : []),
            ...(finalData.lccn ? [{
              identifierTypeId: IdentifierType.LCCN,
              value: finalData.lccn,
              isPrimary: false,
            }] : []),
            ...(finalData.oclcNumber ? [{
              identifierTypeId: IdentifierType.OCLC,
              value: finalData.oclcNumber,
              isPrimary: false,
            }] : []),
          ],
        },
        item: {
          title: finalData.title,
          subtitle: finalData.subtitle,
          notes: finalData.notes,
          barcode: finalData.isbn || finalData.isbn13 || finalData.isbn10,
        },
        contributors: finalData.author ? finalData.author.split(/[,;&]/).map((name, index) => ({
          displayName: name.trim(),
          roleId: ContributorRole.Author,
          ordinal: index + 1,
          sortName: name.trim(),
        })) : [],
        tags: finalData.categories || [],
        subjects: finalData.subjects?.map(subject => ({
          schemeId: SubjectScheme.LCSH,
          text: subject,
        })) || [],
      }

      await createBook(bookRequest, selectedHousehold.id)
      
      navigate('/library')
    } catch (err) {
      setError('Failed to add book. Is the backend API running on port 5259?')
      console.error('Failed to add book:', err)
    } finally {
      setIsLoading(false)
    }
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
    
    const fields = getFieldsByCategory(category)
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

      {/* Quick Add Methods */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <button
          onClick={() => setShowScanner(true)}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            gap: '0.5rem',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '2rem' }}>📷</span>
          <span>Scan Barcode</span>
        </button>

        <form onSubmit={handleSearchSubmit} style={{ width: '100%' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            <input
              type="text"
              className="search-input"
              placeholder="Enter ISBN, title, or 'Title by Author'..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ marginBottom: '0.5rem', width: '100%' }}
            />
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={isLoading || !searchInput.trim()}
              style={{ width: '100%' }}
            >
              {isLoading ? 'Searching...' : '🔍 Search Book'}
            </button>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
              Examples: "9780143127741" or "Body Keeps Score" or "Sapiens by Yuval Noah Harari"
            </p>
          </div>
        </form>
      </div>

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
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '800px' }}>
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

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '2rem',
        }}>
          <button
            type="submit"
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
      </form>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}

export default AddBookPage
