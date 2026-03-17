import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, updateItem, mapItemResponseToBook, getAllHouseholdLocations, getAllHouseholdCategories, createHouseholdCategory, createHouseholdLocation, ContributorRole } from '../api/backend'
import { Book } from '../api/books'
import { FIELD_CATEGORIES, FIELD_DEFINITIONS, type FieldConfig } from '../config/field-config'
import { useHousehold } from '../context/HouseholdContext'

/** Compare original and current form data, return human-readable list of changed field groups */
function computeChangedFields(original: Partial<Book>, current: Partial<Book>): string[] {
  const changed = new Set<string>()

  // Group fields by friendly category name
  const fieldGroups: Record<string, string[]> = {
    'Title/Subtitle': ['title', 'subtitle', 'originalTitle'],
    'Author': ['author'],
    'Description': ['description'],
    'Publisher/Date': ['publisher', 'publishedDate', 'originalPublicationDate', 'copyright', 'printingHistory', 'printRun', 'colophon'],
    'Pages': ['pageCount'],
    'Language': ['language', 'originalLanguage', 'translatedFrom'],
    'Location': ['location', 'locationId'],
    'Status': ['status'],
    'Condition': ['condition'],
    'Read Status': ['readStatus', 'dateStarted', 'completedDate', 'readCount'],
    'Rating': ['userRating', 'userReviewText'],
    'Notes': ['notes'],
    'Format/Binding': ['format', 'binding', 'editionStatement', 'edition', 'printType'],
    'Categories': ['categories', 'mainCategory'],
    'Identifiers': ['isbn', 'isbn13', 'isbn10', 'asin', 'lccn', 'oclcNumber', 'oclcWorkId', 'doi', 'issn', 'googleBooksId', 'goodreadsId', 'libraryThingId', 'olid', 'dnbId', 'bnfId', 'nlaId', 'ndlId', 'lacId', 'blId'],
    'Series': ['series', 'volumeNumber', 'numberOfVolumes'],
    'Contributors': ['translator', 'illustrator', 'editor', 'narrator'],
    'Price': ['purchasePrice', 'price'],
    'Barcode': ['barcode'],
    'Cover Image': ['coverImageUrl'],
    'Classification': ['deweyDecimal', 'deweyEdition', 'lcc', 'lccEdition', 'callNumber', 'bisacCodes', 'thema', 'fastSubjects'],
    'Physical': ['dimensions', 'weight', 'pagination', 'physicalDescription'],
    'Content': ['tableOfContents', 'firstSentence', 'excerpt', 'byStatement', 'bibliography', 'quotes', 'trivia'],
    'Historical': ['churchHistoryPeriod', 'dateWritten', 'religiousTradition'],
    'Subjects': ['subjects'],
  }

  for (const [groupName, keys] of Object.entries(fieldGroups)) {
    for (const key of keys) {
      const oldVal = (original as any)[key]
      const newVal = (current as any)[key]
      const oldStr = Array.isArray(oldVal) ? JSON.stringify(oldVal) : String(oldVal ?? '')
      const newStr = Array.isArray(newVal) ? JSON.stringify(newVal) : String(newVal ?? '')
      if (oldStr !== newStr) {
        changed.add(groupName)
        break
      }
    }
  }

  return Array.from(changed)
}

function BookEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedHousehold } = useHousehold()
  const [formData, setFormData] = useState<Partial<Book>>({})
  const [originalData, setOriginalData] = useState<Partial<Book>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basic']) // Start with basic expanded
  )
  const [newCategory, setNewCategory] = useState('')
  const [knownLocations, setKnownLocations] = useState<{id: string, name: string}[]>([])
  const [knownCategories, setKnownCategories] = useState<string[]>([])
  const [showNewLocationModal, setShowNewLocationModal] = useState(false)
  const [newLocName, setNewLocName] = useState('')
  const [newLocType, setNewLocType] = useState('shelf')
  const [newLocDescription, setNewLocDescription] = useState('')
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [categoryHighlight, setCategoryHighlight] = useState(-1)
  const categoryInputRef = useRef<HTMLInputElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

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
      getAllHouseholdCategories(selectedHousehold.id)
        .then(setKnownCategories)
        .catch(() => {}) // best-effort
    }
  }, [selectedHousehold])

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node) &&
        categoryInputRef.current &&
        !categoryInputRef.current.contains(e.target as Node)
      ) {
        setShowCategorySuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadBook(itemId: string) {
    try {
      setIsLoading(true)
      setError(null)
      const item = await getItem(itemId)
      const mappedBook = mapItemResponseToBook(item)
      setFormData(mappedBook)
      setOriginalData(mappedBook)
    } catch (err) {
      setError('Failed to load book')
      console.error('Failed to load book:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateLocation() {
    if (!newLocName.trim() || !selectedHousehold) return
    try {
      setIsCreatingLocation(true)
      const created = await createHouseholdLocation(selectedHousehold.id, newLocName.trim())
      // Add to known locations list
      setKnownLocations(prev => [...prev, { id: created.id, name: created.name }])
      // Auto-select the newly created location
      handleFieldChange('locationId', created.id)
      handleFieldChange('location', created.name)
      // Close modal & reset
      setShowNewLocationModal(false)
      setNewLocName('')
      setNewLocDescription('')
      setNewLocType('shelf')
    } catch (err: any) {
      alert(err.message || 'Failed to create location')
    } finally {
      setIsCreatingLocation(false)
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
      const contributors: Array<{
        personId?: string; displayName: string; roleId: number; ordinal: number; sortName?: string
      }> = []

      // Always build author contributors from the flat author string (the user-editable field).
      // The d.contributors array is stale structural data from load and doesn't reflect user edits.
      if (d.author) {
        const names = d.author.split(/,\s*|;\s*/).filter((n: string) => n.trim())
        names.forEach((name: string, i: number) => {
          contributors.push({
            displayName: name.trim(),
            roleId: ContributorRole.Author,
            ordinal: i,
          })
        })
      }

      // Always add translator, illustrator, editor, narrator from the flat string fields
      const extraRoles: Array<[string, number]> = [
        ['translator', ContributorRole.Translator],
        ['illustrator', ContributorRole.Illustrator],
        ['editor', ContributorRole.Editor],
        ['narrator', ContributorRole.Narrator],
      ]
      for (const [field, roleId] of extraRoles) {
        if (d[field]) {
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
        ['oclcWorkId', IdentifierType.OCLCWorkId],
        ['dnbId', IdentifierType.DNB],
        ['bnfId', IdentifierType.BNF],
        ['nlaId', IdentifierType.NLA],
        ['ndlId', IdentifierType.NDL],
        ['lacId', IdentifierType.LAC],
        ['blId', IdentifierType.BL],
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
        // Content & community fields
        'byStatement', 'bibliography', 'originalLanguage',
        'quotes', 'trivia', 'reviewsTextCount', 'fiveStarPercent',
        'popularShelves', 'similarBooks',
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
        // Publication extras
        'edition', 'printRun', 'colophon', 'translatedFrom',
        // Access & availability
        'viewability', 'embeddable', 'publicDomain', 'textToSpeechPermission',
        'epubAvailable', 'epubDownloadLink', 'pdfAvailable', 'pdfDownloadLink',
        'webReaderLink', 'quoteSharingAllowed',
        // Sales
        'saleability', 'isEbook', 'saleCountry', 'onSaleDate',
        'listPriceAmount', 'listPriceCurrency', 'retailPriceAmount', 'retailPriceCurrency',
        'buyLink',
        // Links
        'previewLink', 'infoLink', 'canonicalVolumeLink',
      ]
      for (const key of editionMetaFields) {
        if (d[key] !== undefined && d[key] !== null && d[key] !== '') {
          editionMeta[key] = d[key]
        }
      }
      const editionMetadataJson = Object.keys(editionMeta).length > 0
        ? JSON.stringify(editionMeta) : undefined

      // --- Build Item MetadataJson (user-specific and commercial fields) ---
      const itemMeta: Record<string, any> = {}
      const itemMetaFields = [
        'userReviewText', 'readCount', 'isPurchased', 'isPreordered',
        'currentPrice', 'discount', 'usedPrices', 'availability',
        'bestsellerRank', 'librariesOwning', 'nearbyLibraries',
        'dataSources', 'lastUpdated', 'enrichedAt', 'enrichmentSources',
        'acquisitionSource', 'fromWhere', 'purchasePrice', 'bookValue',
        'copies', 'privateNotes', 'collections',
        'lendingPatron', 'lendingStatus', 'lendingStart', 'lendingEnd',
        'ltBookId', 'ltWorkId', 'deweyWording',
        'customFields', 'inventoryVerifiedDate',
      ]
      for (const key of itemMetaFields) {
        if (d[key] !== undefined && d[key] !== null && d[key] !== '') {
          itemMeta[key] = d[key]
        }
      }
      const itemMetadataJson = Object.keys(itemMeta).length > 0
        ? JSON.stringify(itemMeta) : undefined

      // --- Send full PATCH ---
      await updateItem(id, {
        // Item-level fields
        notes: d.notes,
        locationId: d.locationId,
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
        // Item-level metadata
        itemMetadataJson: itemMetadataJson ?? undefined,
        // Related entities
        contributors: contributors.length > 0 ? contributors : undefined,
        subjects: subjects.length > 0 ? subjects : undefined,
        identifiers: identifiers.length > 0 ? identifiers : undefined,
        series,
      }, 'edit', computeChangedFields(originalData, formData))

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
    const trimmed = newCategory.trim()
    if (!trimmed) return
    const currentCategories = Array.isArray(formData.categories) ? formData.categories : []
    if (!currentCategories.includes(trimmed)) {
      setFormData({ 
        ...formData, 
        categories: [...currentCategories, trimmed] 
      })
    }
    // If this is a brand-new category not in the known list, persist it to the master list
    if (!knownCategories.some(c => c.toLowerCase() === trimmed.toLowerCase()) && selectedHousehold) {
      setKnownCategories(prev => [...prev, trimmed].sort((a, b) => a.localeCompare(b)))
      createHouseholdCategory(selectedHousehold.id, trimmed).catch(() => {}) // best-effort
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
          
          {/* Autocomplete input to add category */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={categoryInputRef}
                type="text"
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value)
                  setShowCategorySuggestions(true)
                  setCategoryHighlight(-1)
                }}
                onFocus={() => setShowCategorySuggestions(true)}
                onKeyDown={(e) => {
                  // Compute filtered list inline so arrow/enter work correctly
                  const currentCats = Array.isArray(formData.categories) ? formData.categories.map((c: any) => typeof c === 'string' ? c : c?.name || '') : []
                  const filtered = knownCategories.filter(cat =>
                    !currentCats.includes(cat) &&
                    (newCategory.trim() === '' || cat.toLowerCase().includes(newCategory.trim().toLowerCase()))
                  )

                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (!showCategorySuggestions) setShowCategorySuggestions(true)
                    setCategoryHighlight(prev => {
                      const next = prev < filtered.length - 1 ? prev + 1 : 0
                      // scroll into view
                      setTimeout(() => {
                        categoryDropdownRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                      }, 0)
                      return next
                    })
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setCategoryHighlight(prev => {
                      const next = prev > 0 ? prev - 1 : filtered.length - 1
                      setTimeout(() => {
                        categoryDropdownRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                      }, 0)
                      return next
                    })
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (categoryHighlight >= 0 && categoryHighlight < filtered.length && showCategorySuggestions) {
                      // Select the highlighted suggestion
                      const selected = filtered[categoryHighlight]
                      const cur = Array.isArray(formData.categories) ? formData.categories : []
                      if (!cur.includes(selected)) {
                        setFormData({ ...formData, categories: [...cur, selected] })
                      }
                      setNewCategory('')
                      setShowCategorySuggestions(false)
                      setCategoryHighlight(-1)
                      categoryInputRef.current?.focus()
                    } else {
                      addCategory()
                      setShowCategorySuggestions(false)
                      setCategoryHighlight(-1)
                    }
                  } else if (e.key === 'Escape') {
                    setShowCategorySuggestions(false)
                    setCategoryHighlight(-1)
                  }
                }}
                placeholder="Type to search categories or add new…"
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
                onClick={() => { addCategory(); setShowCategorySuggestions(false) }}
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

            {/* Suggestions dropdown */}
            {showCategorySuggestions && (() => {
              const currentCategories = Array.isArray(formData.categories) ? formData.categories.map((c: any) => typeof c === 'string' ? c : c?.name || '') : []
              const filtered = knownCategories.filter(cat =>
                !currentCategories.includes(cat) &&
                (newCategory.trim() === '' || cat.toLowerCase().includes(newCategory.trim().toLowerCase()))
              )
              if (filtered.length === 0) return null
              return (
                <div
                  ref={categoryDropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '2px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    zIndex: 50
                  }}
                >
                  {filtered.map((cat, idx) => (
                    <div
                      key={cat}
                      onClick={() => {
                        const cur = Array.isArray(formData.categories) ? formData.categories : []
                        if (!cur.includes(cat)) {
                          setFormData({ ...formData, categories: [...cur, cat] })
                        }
                        setNewCategory('')
                        setShowCategorySuggestions(false)
                        setCategoryHighlight(-1)
                        categoryInputRef.current?.focus()
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx === categoryHighlight ? '#e0f2fe' : '#fff'
                      }}
                      onMouseEnter={() => setCategoryHighlight(idx)}
                      onMouseLeave={() => setCategoryHighlight(-1)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              )
            })()}
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
        ) : fieldConfig.key === 'location' ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={(formData as any).locationId as string || ''}
              onChange={(e) => {
                const locId = e.target.value
                if (locId === '__add_new__') {
                  setNewLocName('')
                  setNewLocType('shelf')
                  setNewLocDescription('')
                  setShowNewLocationModal(true)
                  return
                }
                const locName = knownLocations.find(l => l.id === locId)?.name || ''
                handleFieldChange('locationId', locId)
                handleFieldChange('location', locName)
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: 'white'
              }}
            >
              <option value="">— Select Location —</option>
              {knownLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
              <option value="__add_new__">＋ Add new location...</option>
            </select>
          </div>
        ) : (
          <input
            type="text"
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

      {/* Add New Location Modal */}
      {showNewLocationModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowNewLocationModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              Add New Location
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem' }}>
                Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                placeholder="e.g. Living Room Shelf"
                style={{
                  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
                  borderRadius: '6px', fontSize: '0.95rem', outline: 'none',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newLocName.trim()) {
                    e.preventDefault()
                    handleCreateLocation()
                  }
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem' }}>
                Type
              </label>
              <select
                value={newLocType}
                onChange={e => setNewLocType(e.target.value)}
                style={{
                  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
                  borderRadius: '6px', fontSize: '0.95rem', background: 'white', cursor: 'pointer',
                }}
              >
                <option value="room">🏠 Room</option>
                <option value="shelf">📚 Shelf / Bookcase</option>
                <option value="cabinet">🗄️ Cabinet / Closet</option>
                <option value="box">📦 Box / Container</option>
                <option value="other">📍 Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                value={newLocDescription}
                onChange={e => setNewLocDescription(e.target.value)}
                placeholder="Any notes about this location..."
                style={{
                  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
                  borderRadius: '6px', fontSize: '0.95rem', outline: 'none',
                  resize: 'vertical', minHeight: '60px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => { setShowNewLocationModal(false); setNewLocName(''); setNewLocDescription(''); setNewLocType('shelf') }}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: '#64748b',
                }}
              >
                Cancel
              </button>
              <button
                disabled={!newLocName.trim() || isCreatingLocation}
                onClick={handleCreateLocation}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none',
                  backgroundColor: !newLocName.trim() ? '#cbd5e1' : '#3b82f6',
                  color: 'white', fontWeight: 600, cursor: !newLocName.trim() ? 'default' : 'pointer',
                  opacity: isCreatingLocation ? 0.7 : 1,
                }}
              >
                {isCreatingLocation ? '⏳ Creating...' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookEditPage
