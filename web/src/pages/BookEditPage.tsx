import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, updateItem, mapItemResponseToBook, getAllHouseholdLocations, ContributorRole } from '../api/backend'
import { Book } from '../api/books'
import { FIELD_CATEGORIES, FIELD_DEFINITIONS, type FieldConfig } from '../config/field-config'
import { useHousehold } from '../context/HouseholdContext'

function BookEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedHousehold } = useHousehold()
  const [formData, setFormData] = useState<Partial<Book>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basic']) // Start with basic expanded
  )
  const [newCategory, setNewCategory] = useState('')
  const [knownLocations, setKnownLocations] = useState<string[]>([])

  useEffect(() => {
    if (id) {
      loadBook(id)
    }
  }, [id])

  useEffect(() => {
    if (selectedHousehold) {
      getAllHouseholdLocations(selectedHousehold.id)
        .then(setKnownLocations)
        .catch(() => {}) // best-effort
    }
  }, [selectedHousehold])

  async function loadBook(itemId: string) {
    try {
      setIsLoading(true)
      setError(null)
      const item = await getItem(itemId)
      const mappedBook = mapItemResponseToBook(item)
      setFormData(mappedBook)
    } catch (err) {
      setError('Failed to load book')
      console.error('Failed to load book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!id) return

    try {
      setIsSaving(true)
      setError(null)

      const d = formData as any

      // Normalize categories/tags to strings
      const categories = Array.isArray(d.categories) 
        ? d.categories.map((cat: any) => {
            if (typeof cat === 'string') return cat
            if (cat && typeof cat === 'object') {
              return cat.name || cat.text || cat.value || JSON.stringify(cat)
            }
            return String(cat)
          })
        : []

      // --- Build contributors from form data ---
      const roleMap: Record<string, number> = {
        author: ContributorRole.Author,
        editor: ContributorRole.Editor,
        translator: ContributorRole.Translator,
        illustrator: ContributorRole.Illustrator,
        narrator: ContributorRole.Narrator,
        contributor: ContributorRole.Contributor,
      }

      const contributors: Array<{
        personId?: string; displayName: string; roleId: number; ordinal: number; sortName?: string
      }> = []

      // Build from the detailed contributors array if present, otherwise from flat author string
      if (Array.isArray(d.contributors) && d.contributors.length > 0) {
        d.contributors.forEach((c: any, i: number) => {
          if (c.name || c.displayName) {
            contributors.push({
              personId: c.personId,
              displayName: c.name || c.displayName,
              roleId: roleMap[c.role?.toLowerCase()] || ContributorRole.Contributor,
              ordinal: c.ordinal ?? i,
              sortName: c.sortName,
            })
          }
        })
      } else if (d.author) {
        // Split flat author string into individual contributor records
        const names = d.author.split(/,\s*|;\s*/).filter((n: string) => n.trim())
        names.forEach((name: string, i: number) => {
          contributors.push({
            displayName: name.trim(),
            roleId: ContributorRole.Author,
            ordinal: i,
          })
        })
      }

      // Also add translator, illustrator, editor, narrator if set as flat strings
      const extraRoles: Array<[string, number]> = [
        ['translator', ContributorRole.Translator],
        ['illustrator', ContributorRole.Illustrator],
        ['editor', ContributorRole.Editor],
        ['narrator', ContributorRole.Narrator],
      ]
      for (const [field, roleId] of extraRoles) {
        if (d[field] && !contributors.some(c => c.roleId === roleId)) {
          const names = (d[field] as string).split(/,\s*|;\s*/).filter((n: string) => n.trim())
          names.forEach((name: string, i: number) => {
            contributors.push({
              displayName: name.trim(),
              roleId,
              ordinal: contributors.length + i,
            })
          })
        }
      }

      // --- Build identifiers from form data ---
      const IdentifierType = { ISBN10: 1, ISBN13: 2, ISSN: 3, LCCN: 4, OCLC: 5, DOI: 6, ASIN: 7, GoogleBooksId: 8, GoodreadsId: 9, LibraryThingId: 10, OpenLibraryId: 11, OCLCWorkId: 12, DNB: 13, BNF: 14, NLA: 15, NDL: 16, LAC: 17, BL: 18 }
      const identifiers: Array<{ identifierTypeId: number; value: string; isPrimary?: boolean }> = []
      const idFields: Array<[string, number, boolean?]> = [
        ['isbn13', IdentifierType.ISBN13, true],
        ['isbn10', IdentifierType.ISBN10],
        ['issn', IdentifierType.ISSN],
        ['lccn', IdentifierType.LCCN],
        ['oclcNumber', IdentifierType.OCLC],
        ['doi', IdentifierType.DOI],
        ['asin', IdentifierType.ASIN],
        ['googleBooksId', IdentifierType.GoogleBooksId],
        ['goodreadsId', IdentifierType.GoodreadsId],
        ['libraryThingId', IdentifierType.LibraryThingId],
        ['olid', IdentifierType.OpenLibraryId],
      ]
      for (const [field, typeId, isPrimary] of idFields) {
        if (d[field]) {
          identifiers.push({ identifierTypeId: typeId as number, value: d[field], isPrimary: !!isPrimary })
        }
      }

      // --- Build subjects ---
      const subjects: Array<{ schemeId: number; text: string }> = []
      if (Array.isArray(d.subjects)) {
        d.subjects.forEach((s: any) => {
          const text = typeof s === 'string' ? s : s.text
          if (text) subjects.push({ schemeId: s.schemeId || 1, text })
        })
      }

      // --- Build series ---
      const seriesName = d.series || d.seriesInfo?.seriesName
      const series = seriesName ? {
        name: seriesName,
        volumeNumber: d.volumeNumber || d.seriesInfo?.volumeNumber,
        ordinal: d.seriesInfo?.ordinal,
      } : undefined

      // --- Extract year from publishedDate ---
      const extractYear = (dateStr?: string): number | undefined => {
        if (!dateStr) return undefined
        const match = dateStr.match(/(\d{4})/)
        return match ? parseInt(match[1]) : undefined
      }

      // --- Build Work MetadataJson (fields stored in Work.MetadataJson column) ---
      const workMeta: Record<string, any> = {}
      const workMetaFields = [
        'churchHistoryPeriod', 'dateWritten', 'religiousTradition',
        'mainCategory', 'deweyDecimal', 'deweyEdition', 'lcc', 'lccEdition',
        'callNumber', 'bisacCodes', 'thema', 'fastSubjects',
        'tableOfContents', 'firstSentence', 'excerpt',
        'readingAge', 'lexileScore', 'arLevel',
        'averageRating', 'ratingsCount', 'communityRating',
        'numberOfVolumes',
      ]
      for (const key of workMetaFields) {
        if (d[key] !== undefined && d[key] !== null && d[key] !== '') {
          workMeta[key] = d[key]
        }
      }
      const workMetadataJson = Object.keys(workMeta).length > 0
        ? JSON.stringify(workMeta) : undefined

      // --- Build Edition MetadataJson (fields stored in Edition.MetadataJson column) ---
      const editionMeta: Record<string, any> = {}
      const editionMetaFields = [
        'dimensions', 'dimensionsHeight', 'dimensionsWidth', 'dimensionsThickness',
        'weight', 'shippingWeight', 'pagination', 'physicalDescription',
        'printType', 'originalPublicationDate', 'copyright', 'printingHistory',
        'coverImageUrl', 'coverImageSmallThumbnail', 'coverImageThumbnail',
        'coverImageSmall', 'coverImageMedium', 'coverImageLarge', 'coverImageExtraLarge',
        'maturityRating', 'textSnippet',
      ]
      for (const key of editionMetaFields) {
        if (d[key] !== undefined && d[key] !== null && d[key] !== '') {
          editionMeta[key] = d[key]
        }
      }
      const editionMetadataJson = Object.keys(editionMeta).length > 0
        ? JSON.stringify(editionMeta) : undefined

      // --- Send full PATCH ---
      await updateItem(id, {
        // Item-level fields
        notes: d.notes,
        location: d.location || d.pln,
        status: d.status,
        condition: d.condition,
        acquiredOn: d.acquiredDate,
        price: d.purchasePrice ? parseFloat(d.purchasePrice) : (d.price ? Number(d.price) : undefined),
        barcode: d.barcode,
        readStatus: d.readStatus,
        completedDate: d.completedDate,
        dateStarted: d.dateStarted,
        userRating: d.userRating ? Number(d.userRating) : undefined,
        tags: categories,
        // Work-level fields
        work: {
          title: d.title,
          subtitle: d.subtitle || null,
          description: d.description || null,
          originalTitle: d.originalTitle || null,
          language: d.language || null,
          metadataJson: workMetadataJson ?? null,
        },
        // Edition-level fields
        edition: {
          publisher: d.publisher || null,
          publishedYear: extractYear(d.publishedDate) ?? null,
          pageCount: d.pageCount ? Number(d.pageCount) : null,
          format: d.format || null,
          binding: d.binding || null,
          editionStatement: d.editionStatement || null,
          placeOfPublication: d.placeOfPublication || null,
          language: d.language || null,
          metadataJson: editionMetadataJson ?? null,
        },
        // Related entities
        contributors: contributors.length > 0 ? contributors : undefined,
        subjects: subjects.length > 0 ? subjects : undefined,
        identifiers: identifiers.length > 0 ? identifiers : undefined,
        series,
      }, 'edit')

      navigate(`/book/${id}`)
    } catch (err) {
      setError('Failed to save changes')
      console.error('Failed to save:', err)
    } finally {
      setIsSaving(false)
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

  function handleFieldChange(fieldKey: string, value: any) {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  function addCategory() {
    if (!newCategory.trim()) return
    const currentCategories = Array.isArray(formData.categories) ? formData.categories : []
    if (!currentCategories.includes(newCategory.trim())) {
      setFormData({ 
        ...formData, 
        categories: [...currentCategories, newCategory.trim()] 
      })
    }
    setNewCategory('')
  }

  function removeCategory(categoryToRemove: string) {
    const currentCategories = Array.isArray(formData.categories) ? formData.categories : []
    setFormData({ 
      ...formData, 
      categories: currentCategories.filter(c => c !== categoryToRemove) 
    })
  }

  function renderField(fieldConfig: FieldConfig) {
    const value = formData[fieldConfig.key as keyof Book]
    const isRequired = fieldConfig.required

    // Special handling for categories field
    if (fieldConfig.key === 'categories') {
      const categories = Array.isArray(value) ? value : []
      return (
        <div key={fieldConfig.key} style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: 500, 
            fontSize: '0.9rem' 
          }}>
            {fieldConfig.label}
            {isRequired && <span style={{ color: '#dc2626' }}> *</span>}
          </label>
          
          {/* Display existing categories as chips */}
          {categories.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.5rem', 
              marginBottom: '0.75rem' 
            }}>
              {categories.map((category: string | any) => {
                const categoryText = typeof category === 'string' 
                  ? category 
                  : category?.name || category?.text || category?.value || JSON.stringify(category)
                return (
              <div
                key={categoryText}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {categoryText}
                <button
                  type="button"
                  onClick={() => removeCategory(categoryText)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0369a1',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '1rem',
                    lineHeight: 1
                  }}
                  title="Remove category"
                >
                  ×
                </button>
              </div>
                )
              })}
          </div>
          )}
          
          {/* Input to add new category */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
              placeholder="Add custom category (e.g., Cycling)"
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem'
              }}
            />
            <button
              type="button"
              onClick={addCategory}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Add
            </button>
          </div>
        </div>
      )
    }

    return (
      <div key={fieldConfig.key} style={{ marginBottom: '1rem' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '0.5rem', 
          fontWeight: 500, 
          fontSize: '0.9rem' 
        }}>
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
          <p style={{ 
            fontSize: '0.75rem', 
            color: '#64748b', 
            marginBottom: '0.5rem' 
          }}>
            {fieldConfig.description}
          </p>
        )}

        {fieldConfig.type === 'textarea' ? (
          <textarea
            value={value as string || ''}
            onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
            placeholder={fieldConfig.placeholder}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              fontFamily: 'inherit'
            }}
          />
        ) : fieldConfig.type === 'number' ? (
          <input
            type="number"
            value={value as number || ''}
            onChange={(e) => handleFieldChange(fieldConfig.key, e.target.valueAsNumber || undefined)}
            placeholder={fieldConfig.placeholder}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem'
            }}
          />
        ) : fieldConfig.type === 'array' ? (
          <input
            type="text"
            value={
              Array.isArray(value) 
                ? value.map(item => {
                    if (typeof item === 'string') return item
                    if (item && typeof item === 'object') {
                      return item.name || item.text || item.value || JSON.stringify(item)
                    }
                    return String(item)
                  }).join(', ')
                : ''
            }
            onChange={(e) => {
              const arrayValue = e.target.value.split(',').map(v => v.trim()).filter(v => v)
              handleFieldChange(fieldConfig.key, arrayValue)
            }}
            placeholder={fieldConfig.placeholder || 'Comma-separated values'}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem'
            }}
          />
        ) : fieldConfig.type === 'url' ? (
          <input
            type="url"
            value={value as string || ''}
            onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
            placeholder={fieldConfig.placeholder}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem'
            }}
          />
        ) : fieldConfig.type === 'select' && fieldConfig.options ? (
          <select
            value={value as string || ''}
            onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value || undefined)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              backgroundColor: 'white'
            }}
          >
            <option value="">— Select —</option>
            {fieldConfig.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (fieldConfig.key === 'location' || fieldConfig.key === 'pln') && knownLocations.length > 0 ? (
          <>
            <input
              type="text"
              list={`datalist-${fieldConfig.key}`}
              value={value as string || ''}
              onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
              placeholder={fieldConfig.placeholder || 'Select or type a location'}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
              }}
            />
            <datalist id={`datalist-${fieldConfig.key}`}>
              {knownLocations.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </>
        ) : (
          <input
            type="text"
            value={value as string || ''}
            onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
            placeholder={fieldConfig.placeholder}
            readOnly={fieldConfig.source !== 'user' && value !== undefined && value !== null && value !== ''}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              backgroundColor: (fieldConfig.source !== 'user' && value !== undefined && value !== null && value !== '') ? '#f8fafc' : 'white'
            }}
          />
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <button onClick={() => navigate(`/book/${id}`)} className="btn btn-secondary">
            ← Cancel
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </div>
    )
  }

  if (error && !formData.id) {
    return (
      <div>
        <div className="page-header">
          <button onClick={() => navigate('/library')} className="btn btn-secondary">
            ← Back to Library
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Edit Book</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => navigate(`/book/${id}`)} className="btn btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          {error}
        </div>
      )}

      {/* Book Title Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          {formData.title || 'Untitled'}
        </h2>
        {formData.subtitle && (
          <p style={{ fontSize: '1rem', color: '#64748b' }}>
            {formData.subtitle}
          </p>
        )}
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          by {formData.author || 'Unknown Author'}
        </p>
      </div>

      {/* Collapsible Field Categories */}
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {FIELD_CATEGORIES.map((category) => {
          const fields = FIELD_DEFINITIONS.filter(f => f.category === category.key)
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
                type="button"
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
                  {category.description && (
                    <span style={{ 
                      marginLeft: '0.75rem', 
                      fontSize: '0.75rem', 
                      color: '#94a3b8',
                      fontWeight: 400 
                    }}>
                      {category.description}
                    </span>
                  )}
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
                  <div className="two-col-grid" style={{
                    marginTop: '1rem'
                  }}>
                    {fields.map(field => renderField(field))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Save/Cancel Buttons */}
        <div className="sticky-action-bar" style={{
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <button 
            type="button"
            onClick={() => navigate(`/book/${id}`)} 
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit"
            onClick={(e) => { e.preventDefault(); handleSave(); }}
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BookEditPage
