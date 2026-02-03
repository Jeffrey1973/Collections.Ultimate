import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { searchBook, Book } from '../api/books'
import { createBook, IdentifierType, ContributorRole, SubjectScheme, type CreateBookIngestRequest } from '../api/backend'
import { useHousehold } from '../context/HouseholdContext'

// Define all available fields with their metadata
type FieldConfig = {
  key: keyof Book
  label: string
  type: 'text' | 'textarea' | 'number' | 'url' | 'date'
  category: 'basic' | 'extended' | 'contributors' | 'identifiers' | 'classification' | 'physical' | 'publication' | 'content' | 'reading' | 'ratings'
}

const AVAILABLE_FIELDS: FieldConfig[] = [
  // Basic fields
  { key: 'title', label: 'Title', type: 'text', category: 'basic' },
  { key: 'author', label: 'Author', type: 'text', category: 'basic' },
  { key: 'isbn', label: 'ISBN', type: 'text', category: 'basic' },
  { key: 'description', label: 'Description', type: 'textarea', category: 'basic' },
  { key: 'publisher', label: 'Publisher', type: 'text', category: 'basic' },
  { key: 'publishedDate', label: 'Published Date', type: 'text', category: 'basic' },
  { key: 'pageCount', label: 'Page Count', type: 'number', category: 'basic' },
  { key: 'language', label: 'Language', type: 'text', category: 'basic' },
  { key: 'coverImageUrl', label: 'Cover Image URL', type: 'url', category: 'basic' },
  
  // Extended title info
  { key: 'subtitle', label: 'Subtitle', type: 'text', category: 'extended' },
  { key: 'originalTitle', label: 'Original Title', type: 'text', category: 'extended' },
  { key: 'series', label: 'Series', type: 'text', category: 'extended' },
  { key: 'edition', label: 'Edition', type: 'text', category: 'extended' },
  
  // Contributors
  { key: 'translator', label: 'Translator', type: 'text', category: 'contributors' },
  { key: 'illustrator', label: 'Illustrator', type: 'text', category: 'contributors' },
  { key: 'editor', label: 'Editor', type: 'text', category: 'contributors' },
  { key: 'narrator', label: 'Narrator', type: 'text', category: 'contributors' },
  { key: 'translatedFrom', label: 'Translated From', type: 'text', category: 'contributors' },
  
  // Identifiers
  { key: 'isbn10', label: 'ISBN-10', type: 'text', category: 'identifiers' },
  { key: 'isbn13', label: 'ISBN-13', type: 'text', category: 'identifiers' },
  { key: 'lccn', label: 'LCCN', type: 'text', category: 'identifiers' },
  { key: 'oclcNumber', label: 'OCLC Number', type: 'text', category: 'identifiers' },
  { key: 'doi', label: 'DOI', type: 'text', category: 'identifiers' },
  { key: 'asin', label: 'ASIN', type: 'text', category: 'identifiers' },
  
  // Classification
  { key: 'callNumber', label: 'Call Number', type: 'text', category: 'classification' },
  { key: 'deweyDecimal', label: 'Dewey Decimal', type: 'text', category: 'classification' },
  { key: 'lcc', label: 'Library of Congress Classification', type: 'text', category: 'classification' },
  
  // Physical details
  { key: 'format', label: 'Format', type: 'text', category: 'physical' },
  { key: 'dimensions', label: 'Dimensions', type: 'text', category: 'physical' },
  { key: 'weight', label: 'Weight', type: 'text', category: 'physical' },
  { key: 'physicalDescription', label: 'Physical Description', type: 'text', category: 'physical' },
  
  // Publication info
  { key: 'placeOfPublication', label: 'Place of Publication', type: 'text', category: 'publication' },
  { key: 'originalPublicationDate', label: 'Original Publication Date', type: 'text', category: 'publication' },
  { key: 'copyright', label: 'Copyright', type: 'text', category: 'publication' },
  { key: 'printingHistory', label: 'Printing History', type: 'text', category: 'publication' },
  { key: 'editionStatement', label: 'Edition Statement', type: 'text', category: 'publication' },
]

const DEFAULT_MAIN_FIELDS: (keyof Book)[] = ['title', 'author', 'isbn', 'description', 'publisher', 'publishedDate', 'pageCount', 'language', 'coverImageUrl']

function AddBookPage() {
  const navigate = useNavigate()
  const { selectedHousehold, isLoading: isLoadingHousehold } = useHousehold()
  const [showScanner, setShowScanner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number; apiName: string } | null>(null)
  const [showFieldCustomizer, setShowFieldCustomizer] = useState(false)
  
  // Load field preferences from localStorage
  const [mainFields, setMainFields] = useState<(keyof Book)[]>(() => {
    const saved = localStorage.getItem('bookFormMainFields')
    return saved ? JSON.parse(saved) : DEFAULT_MAIN_FIELDS
  })
  
  // Save field preferences when changed
  useEffect(() => {
    localStorage.setItem('bookFormMainFields', JSON.stringify(mainFields))
  }, [mainFields])
  
  // Form state
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
    callNumber: '',
    edition: '',
    placeOfPublication: '',
    physicalDescription: '',
    series: '',
    subjects: [],
    notes: '',
    dimensions: '',
    subtitle: '',
    originalTitle: '',
    translatedFrom: '',
    translator: '',
    illustrator: '',
    editor: '',
    narrator: '',
    format: '',
    weight: '',
    deweyDecimal: '',
    lcc: '',
    oclcNumber: '',
    lccn: '',
    bisacCodes: [],
    thema: [],
    awards: [],
    tableOfContents: '',
    firstSentence: '',
    excerpt: '',
    readingAge: '',
    lexileScore: '',
    arLevel: '',
    printingHistory: '',
    copyright: '',
    originalPublicationDate: '',
    editionStatement: '',
    numberOfVolumes: undefined,
    volumeNumber: undefined,
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

  function handleInputChange(field: keyof Book, value: string | number | undefined) {
    setFormData({
      ...formData,
      [field]: value,
    })
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
      // Map frontend Book format to backend CreateBookIngestRequest format
      const bookRequest: CreateBookIngestRequest = {
        work: {
          title: formData.title,
          subtitle: formData.subtitle,
          sortTitle: formData.title, // Could be improved with better sort logic
          description: formData.description,
        },
        edition: {
          editionTitle: formData.title,
          editionSubtitle: formData.subtitle,
          publisher: formData.publisher,
          publishedYear: formData.publishedDate ? parseInt(formData.publishedDate.split('-')[0]) : undefined,
          pageCount: formData.pageCount,
          description: formData.description,
          identifiers: [
            ...(formData.isbn13 ? [{
              identifierTypeId: IdentifierType.ISBN13,
              value: formData.isbn13,
              isPrimary: true,
            }] : []),
            ...(formData.isbn10 ? [{
              identifierTypeId: IdentifierType.ISBN10,
              value: formData.isbn10,
              isPrimary: !formData.isbn13,
            }] : []),
            ...(formData.isbn && !formData.isbn13 && !formData.isbn10 ? [{
              identifierTypeId: formData.isbn.length === 13 ? IdentifierType.ISBN13 : IdentifierType.ISBN10,
              value: formData.isbn,
              isPrimary: true,
            }] : []),
            ...(formData.lccn ? [{
              identifierTypeId: IdentifierType.LCCN,
              value: formData.lccn,
              isPrimary: false,
            }] : []),
            ...(formData.oclcNumber ? [{
              identifierTypeId: IdentifierType.OCLC,
              value: formData.oclcNumber,
              isPrimary: false,
            }] : []),
          ],
        },
        item: {
          title: formData.title,
          subtitle: formData.subtitle,
          notes: formData.notes,
          barcode: formData.isbn || formData.isbn13 || formData.isbn10,
          location: undefined,
          status: undefined,
          condition: undefined,
          acquiredOn: undefined,
          price: undefined,
        },
        contributors: formData.author ? formData.author.split(/[,;&]/).map((name, index) => ({
          displayName: name.trim(),
          roleId: ContributorRole.Author,
          ordinal: index + 1,
          sortName: name.trim(),
        })) : [],
        tags: formData.categories || [],
        subjects: formData.subjects?.map(subject => ({
          schemeId: SubjectScheme.LCSH,
          text: subject,
        })) || [],
      }

      await createBook(bookRequest, selectedHousehold.id)
      
      navigate('/library')
    } catch (err) {
      setError('Failed to add book. Is the backend API running on port 5258?')
      console.error('Failed to add book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    navigate('/library')
  }

  function toggleFieldInMain(fieldKey: keyof Book) {
    setMainFields(prev => {
      if (prev.includes(fieldKey)) {
        // Must keep at least title and author
        if (fieldKey === 'title' || fieldKey === 'author') return prev
        return prev.filter(f => f !== fieldKey)
      } else {
        return [...prev, fieldKey]
      }
    })
  }

  function resetToDefaults() {
    setMainFields(DEFAULT_MAIN_FIELDS)
  }

  // Separate fields into main and advanced based on user preferences
  const mainFieldConfigs = AVAILABLE_FIELDS.filter(f => mainFields.includes(f.key))
  const advancedFieldConfigs = AVAILABLE_FIELDS.filter(f => !mainFields.includes(f.key))

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
          Scan a barcode, enter ISBN, or fill out manually
        </p>
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          fontSize: '0.9rem',
        }}>
          📚 <strong>API Info:</strong> Currently searching ~8-10 browser-accessible APIs (Google Books, Open Library, CrossRef, Internet Archive, HathiTrust, ERIC, PubMed, Wikidata). Many other APIs are blocked by browser security (CORS). To access all 56 APIs, a backend server would be needed.
        </div>
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

      {/* Book Form */}
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Book Details</h2>
          <button
            type="button"
            onClick={() => setShowFieldCustomizer(!showFieldCustomizer)}
            className="btn btn-secondary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            ⚙️ Customize Fields
          </button>
        </div>

        {/* Field Customizer Panel */}
        {showFieldCustomizer && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f8fafc',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Main Form Fields</h3>
              <button
                type="button"
                onClick={resetToDefaults}
                style={{
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  backgroundColor: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Reset to Defaults
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Check the fields you want to see in the main form. Unchecked fields will appear in "Advanced Catalog Fields".
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem',
            }}>
              {AVAILABLE_FIELDS.map(field => {
                const isRequired = field.key === 'title' || field.key === 'author'
                const isChecked = mainFields.includes(field.key)
                return (
                  <label
                    key={field.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: isChecked ? '#dbeafe' : 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      cursor: isRequired ? 'not-allowed' : 'pointer',
                      opacity: isRequired ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleFieldInMain(field.key)}
                      disabled={isRequired}
                      style={{ cursor: isRequired ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem' }}>
                      {field.label}
                      {isRequired && ' *'}
                    </span>
                  </label>
                )
              })}
            </div>
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

        {/* Main Form Fields - Dynamically Rendered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mainFieldConfigs.map(field => {
            const isRequired = field.key === 'title' || field.key === 'author'
            const value = formData[field.key]
            
            return (
              <div key={field.key}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  {field.label} {isRequired && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="search-input"
                    value={value as string || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    rows={4}
                    style={{ resize: 'vertical' }}
                    required={isRequired}
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    className="search-input"
                    value={value as number || ''}
                    onChange={(e) => handleInputChange(field.key, parseInt(e.target.value) || undefined)}
                    required={isRequired}
                  />
                ) : (
                  <input
                    type={field.type}
                    className="search-input"
                    value={value as string || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    required={isRequired}
                  />
                )}
              </div>
            )
          })}

          {/* Advanced Catalog Fields - Collapsible */}
          {advancedFieldConfigs.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: 600,
                padding: '0.5rem',
                backgroundColor: '#f1f5f9',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}>
                📇 Advanced Catalog Fields ({advancedFieldConfigs.length} fields)
              </summary>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1rem' }}>
                {advancedFieldConfigs.map(field => {
                  const value = formData[field.key]
                  
                  return (
                    <div key={field.key}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="search-input"
                          value={value as string || ''}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          rows={3}
                          style={{ resize: 'vertical' }}
                        />
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          className="search-input"
                          value={value as number || ''}
                          onChange={(e) => handleInputChange(field.key, parseInt(e.target.value) || undefined)}
                        />
                      ) : (
                        <input
                          type={field.type}
                          className="search-input"
                          value={value as string || ''}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {/* Notes field - always show at the end */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Personal Notes
            </label>
            <textarea
              className="search-input"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              placeholder="Your personal notes about this book..."
              style={{ resize: 'vertical' }}
            />
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
