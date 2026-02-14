/**
 * Book enrichment service — searches external APIs and computes diffs
 * against the current book data for selective field updates.
 */

import { Book, lookupBookByISBN, searchBookMultiple } from './books'
import { updateItem, IdentifierType, ContributorRole, SubjectScheme } from './backend'

/** A single field-level diff between current book data and API-enriched data */
export interface FieldDiff {
  key: keyof Book
  label: string
  category: string
  currentValue: any
  newValue: any
  /** true when the current value is empty/missing */
  isNewField: boolean
}

/** Result of enriching a single book */
export interface EnrichmentResult {
  bookId: string
  bookTitle: string
  diffs: FieldDiff[]
  apiData: Partial<Book>
  dataSources: string[]
  error?: string
}

/** Labels for diff display */
const FIELD_LABELS: Record<string, string> = {
  title: 'Title', subtitle: 'Subtitle', author: 'Author', originalTitle: 'Original Title',
  coverImageUrl: 'Cover Image', description: 'Description', publisher: 'Publisher',
  publishedDate: 'Published Date', pageCount: 'Page Count', language: 'Language',
  categories: 'Categories', subjects: 'Subjects', isbn10: 'ISBN-10', isbn13: 'ISBN-13',
  lccn: 'LCCN', oclcNumber: 'OCLC Number', doi: 'DOI', asin: 'ASIN',
  googleBooksId: 'Google Books ID', goodreadsId: 'Goodreads ID',
  libraryThingId: 'LibraryThing ID', olid: 'Open Library ID',
  deweyDecimal: 'Dewey Decimal', lcc: 'LC Classification', callNumber: 'Call Number',
  format: 'Format', binding: 'Binding', dimensions: 'Dimensions', weight: 'Weight',
  editionStatement: 'Edition Statement', placeOfPublication: 'Place of Publication',
  translator: 'Translator', illustrator: 'Illustrator', editor: 'Editor',
  narrator: 'Narrator', series: 'Series', volumeNumber: 'Volume Number',
  numberOfVolumes: 'Number of Volumes', excerpt: 'Excerpt', firstSentence: 'First Sentence',
  tableOfContents: 'Table of Contents', readingAge: 'Reading Age',
  lexileScore: 'Lexile Score', averageRating: 'Average Rating',
  ratingsCount: 'Ratings Count', reviewsCount: 'Reviews Count',
  previewLink: 'Preview Link', infoLink: 'Info Link', buyLink: 'Buy Link',
  bisacCodes: 'BISAC Codes', thema: 'Thema Codes', fastSubjects: 'FAST Subjects',
  awards: 'Awards', copyright: 'Copyright', printingHistory: 'Printing History',
  physicalDescription: 'Physical Description', pagination: 'Pagination',
  originalPublicationDate: 'Original Publication Date',
  edition: 'Edition', notes: 'Notes', mainCategory: 'Main Category',
  barcode: 'Barcode', oclcWorkId: 'OCLC Work ID',
  churchHistoryPeriod: 'Church History Period', dateWritten: 'Date Written',
  religiousTradition: 'Religious Tradition',
  dnbId: 'DNB ID', bnfId: 'BNF ID', nlaId: 'NLA ID',
  issn: 'ISSN', blId: 'British Library ID',
}

/** Fields that are worth comparing (skip internal/tracking fields) */
const ENRICHABLE_FIELDS: (keyof Book)[] = [
  'title', 'subtitle', 'author', 'originalTitle',
  'coverImageUrl', 'description', 'publisher', 'publishedDate', 'pageCount', 'language',
  'categories', 'subjects', 'isbn10', 'isbn13', 'issn', 'lccn', 'oclcNumber', 'oclcWorkId',
  'doi', 'asin', 'googleBooksId', 'goodreadsId', 'libraryThingId', 'olid',
  'dnbId', 'bnfId', 'nlaId', 'blId',
  'deweyDecimal', 'lcc', 'callNumber', 'bisacCodes', 'thema', 'fastSubjects',
  'mainCategory',
  'format', 'binding', 'dimensions', 'weight', 'editionStatement', 'placeOfPublication',
  'edition', 'copyright', 'printingHistory', 'physicalDescription', 'pagination',
  'originalPublicationDate',
  'translator', 'illustrator', 'editor', 'narrator',
  'series', 'volumeNumber', 'numberOfVolumes',
  'excerpt', 'firstSentence', 'tableOfContents',
  'readingAge', 'lexileScore', 'averageRating', 'ratingsCount', 'reviewsCount',
  'previewLink', 'infoLink', 'buyLink', 'awards',
  'churchHistoryPeriod', 'dateWritten', 'religiousTradition',
]

/** Categorize fields for grouping in the UI */
function fieldCategory(key: string): string {
  if (['title', 'subtitle', 'author', 'originalTitle', 'coverImageUrl', 'description', 'language'].includes(key)) return 'Basic Info'
  if (['publisher', 'publishedDate', 'pageCount', 'format', 'binding', 'edition', 'editionStatement', 'placeOfPublication', 'originalPublicationDate', 'copyright', 'printingHistory'].includes(key)) return 'Publication'
  if (['isbn10', 'isbn13', 'issn', 'lccn', 'oclcNumber', 'oclcWorkId', 'doi', 'asin', 'googleBooksId', 'goodreadsId', 'libraryThingId', 'olid', 'dnbId', 'bnfId', 'nlaId', 'blId'].includes(key)) return 'Identifiers'
  if (['categories', 'subjects', 'deweyDecimal', 'lcc', 'callNumber', 'bisacCodes', 'thema', 'fastSubjects', 'mainCategory'].includes(key)) return 'Classification'
  if (['dimensions', 'weight', 'physicalDescription', 'pagination'].includes(key)) return 'Physical'
  if (['translator', 'illustrator', 'editor', 'narrator'].includes(key)) return 'Contributors'
  if (['series', 'volumeNumber', 'numberOfVolumes'].includes(key)) return 'Series'
  if (['excerpt', 'firstSentence', 'tableOfContents', 'readingAge', 'lexileScore'].includes(key)) return 'Content'
  if (['averageRating', 'ratingsCount', 'reviewsCount'].includes(key)) return 'Ratings'
  if (['previewLink', 'infoLink', 'buyLink'].includes(key)) return 'Links'
  if (['awards'].includes(key)) return 'Awards'
  if (['churchHistoryPeriod', 'dateWritten', 'religiousTradition'].includes(key)) return 'Historical'
  return 'Other'
}

/** Check if a value is "empty" */
function isEmpty(val: any): boolean {
  if (val === undefined || val === null || val === '') return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

/** Check if two values are meaningfully different */
function isDifferent(current: any, incoming: any): boolean {
  if (isEmpty(current) && isEmpty(incoming)) return false
  if (isEmpty(current) && !isEmpty(incoming)) return true
  if (!isEmpty(current) && isEmpty(incoming)) return false

  // Array comparison
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const curSet = new Set(current.map((v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v)))
    const newSet = new Set(incoming.map((v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v)))
    // New data has items not in current
    for (const item of newSet) {
      if (!curSet.has(item)) return true
    }
    return false
  }

  // Normalize strings for comparison
  if (typeof current === 'string' && typeof incoming === 'string') {
    return current.trim().toLowerCase() !== incoming.trim().toLowerCase()
  }

  return String(current) !== String(incoming)
}

/**
 * Enrich a single book: look up data from external APIs and compute field diffs.
 */
export async function enrichBook(
  book: Book,
  onProgress?: (current: number, total: number, status: string) => void,
): Promise<EnrichmentResult> {
  try {
    // Determine the best lookup strategy
    const isbn = book.isbn13 || book.isbn10 || book.isbn || book.barcode
    let apiData: Partial<Book> | null = null

    if (isbn && /^\d{10,13}$/.test(isbn)) {
      // ISBN lookup — cascading APIs
      if (onProgress) onProgress(0, 100, `Looking up ISBN ${isbn}...`)
      apiData = await lookupBookByISBN(isbn, (cur, tot, api) => {
        if (onProgress) onProgress(cur, tot, `Querying ${api}...`)
      })
    }

    if (!apiData) {
      // Fallback: title+author search
      const query = `${book.title} ${book.author}`.trim()
      if (onProgress) onProgress(0, 4, `Searching for "${query}"...`)
      const results = await searchBookMultiple(query, (cur, tot, status) => {
        if (onProgress) onProgress(cur, tot, status)
      })
      // Pick the best match (first result, which is highest ranked)
      if (results.length > 0) {
        apiData = results[0]
      }
    }

    if (!apiData) {
      return {
        bookId: book.id,
        bookTitle: book.title,
        diffs: [],
        apiData: {},
        dataSources: [],
        error: 'No data found from any API',
      }
    }

    // Compute field-by-field diffs
    const diffs: FieldDiff[] = []
    for (const key of ENRICHABLE_FIELDS) {
      const currentValue = (book as any)[key]
      const newValue = (apiData as any)[key]

      if (!isEmpty(newValue) && isDifferent(currentValue, newValue)) {
        diffs.push({
          key,
          label: FIELD_LABELS[key] || key,
          category: fieldCategory(key),
          currentValue,
          newValue,
          isNewField: isEmpty(currentValue),
        })
      }
    }

    return {
      bookId: book.id,
      bookTitle: book.title,
      diffs,
      apiData,
      dataSources: apiData.dataSources || [],
    }
  } catch (err: any) {
    return {
      bookId: book.id,
      bookTitle: book.title,
      diffs: [],
      apiData: {},
      dataSources: [],
      error: err.message || 'Enrichment failed',
    }
  }
}

/**
 * Apply selected diffs to a book via the PATCH endpoint.
 * Takes the original book and the selected FieldDiff entries,
 * builds the proper patch payload.
 */
export async function applyEnrichment(
  book: Book,
  selectedDiffs: FieldDiff[],
  _fullApiData: Partial<Book>,
  dataSources?: string[],
): Promise<void> {
  if (selectedDiffs.length === 0) return

  // Build the merged book with selected fields applied
  const enrichedBook: any = { ...book }
  for (const diff of selectedDiffs) {
    enrichedBook[diff.key] = diff.newValue
  }

  // Now build the PATCH payload using the same logic as BookEditPage
  const extractYear = (dateStr?: string): number | undefined => {
    if (!dateStr) return undefined
    const m = dateStr.match(/\d{4}/)
    return m ? parseInt(m[0]) : undefined
  }

  // Check which categories of fields are being updated
  const hasWorkFields = selectedDiffs.some(d =>
    ['title', 'subtitle', 'originalTitle', 'description', 'language',
     'deweyDecimal', 'lcc', 'callNumber', 'mainCategory', 'churchHistoryPeriod',
     'dateWritten', 'religiousTradition'].includes(d.key)
  )
  const hasEditionFields = selectedDiffs.some(d =>
    ['publisher', 'publishedDate', 'pageCount', 'format', 'binding',
     'editionStatement', 'placeOfPublication', 'dimensions', 'weight',
     'edition', 'copyright', 'coverImageUrl'].includes(d.key)
  )
  const hasIdentifierFields = selectedDiffs.some(d =>
    ['isbn10', 'isbn13', 'issn', 'lccn', 'oclcNumber', 'oclcWorkId', 'doi',
     'asin', 'googleBooksId', 'goodreadsId', 'libraryThingId', 'olid',
     'dnbId', 'bnfId', 'nlaId', 'blId'].includes(d.key)
  )
  const hasContributorFields = selectedDiffs.some(d =>
    ['author', 'translator', 'illustrator', 'editor', 'narrator'].includes(d.key)
  )
  const hasSubjectFields = selectedDiffs.some(d =>
    ['subjects', 'categories'].includes(d.key)
  )

  // Build work metadata
  const workMeta: Record<string, any> = {}
  if (enrichedBook.deweyDecimal) workMeta.deweyDecimal = enrichedBook.deweyDecimal
  if (enrichedBook.lcc) workMeta.lcc = enrichedBook.lcc
  if (enrichedBook.callNumber) workMeta.callNumber = enrichedBook.callNumber
  if (enrichedBook.mainCategory) workMeta.mainCategory = enrichedBook.mainCategory
  if (enrichedBook.bisacCodes) workMeta.bisacCodes = enrichedBook.bisacCodes
  if (enrichedBook.thema) workMeta.thema = enrichedBook.thema
  if (enrichedBook.fastSubjects) workMeta.fastSubjects = enrichedBook.fastSubjects
  if (enrichedBook.tableOfContents) workMeta.tableOfContents = enrichedBook.tableOfContents
  if (enrichedBook.firstSentence) workMeta.firstSentence = enrichedBook.firstSentence
  if (enrichedBook.excerpt) workMeta.excerpt = enrichedBook.excerpt
  if (enrichedBook.readingAge) workMeta.readingAge = enrichedBook.readingAge
  if (enrichedBook.lexileScore) workMeta.lexileScore = enrichedBook.lexileScore
  if (enrichedBook.averageRating) workMeta.averageRating = enrichedBook.averageRating
  if (enrichedBook.ratingsCount) workMeta.ratingsCount = enrichedBook.ratingsCount
  if (enrichedBook.churchHistoryPeriod) workMeta.churchHistoryPeriod = enrichedBook.churchHistoryPeriod
  if (enrichedBook.dateWritten) workMeta.dateWritten = enrichedBook.dateWritten
  if (enrichedBook.religiousTradition) workMeta.religiousTradition = enrichedBook.religiousTradition

  // Build edition metadata
  const editionMeta: Record<string, any> = {}
  if (enrichedBook.dimensions) editionMeta.dimensions = enrichedBook.dimensions
  if (enrichedBook.weight) editionMeta.weight = enrichedBook.weight
  if (enrichedBook.physicalDescription) editionMeta.physicalDescription = enrichedBook.physicalDescription
  if (enrichedBook.pagination) editionMeta.pagination = enrichedBook.pagination
  if (enrichedBook.copyright) editionMeta.copyright = enrichedBook.copyright
  if (enrichedBook.printingHistory) editionMeta.printingHistory = enrichedBook.printingHistory
  if (enrichedBook.coverImageUrl) editionMeta.coverImageUrl = enrichedBook.coverImageUrl

  // Build the patch payload
  const patchData: any = {}

  if (hasWorkFields) {
    patchData.work = {
      title: enrichedBook.title,
      subtitle: enrichedBook.subtitle || null,
      description: enrichedBook.description || null,
      originalTitle: enrichedBook.originalTitle || null,
      language: enrichedBook.language || null,
      metadataJson: Object.keys(workMeta).length > 0 ? JSON.stringify(workMeta) : null,
    }
  }

  if (hasEditionFields) {
    patchData.edition = {
      publisher: enrichedBook.publisher || null,
      publishedYear: extractYear(enrichedBook.publishedDate) ?? null,
      pageCount: enrichedBook.pageCount ? Number(enrichedBook.pageCount) || null : null,
      format: enrichedBook.format || null,
      binding: enrichedBook.binding || null,
      editionStatement: enrichedBook.editionStatement || null,
      placeOfPublication: enrichedBook.placeOfPublication || null,
      language: enrichedBook.language || null,
      metadataJson: Object.keys(editionMeta).length > 0 ? JSON.stringify(editionMeta) : null,
    }
  }

  // Build identifiers from enriched book
  if (hasIdentifierFields) {
    const identifiers: Array<{ identifierTypeId: number; value: string; isPrimary?: boolean }> = []
    if (enrichedBook.isbn13) identifiers.push({ identifierTypeId: IdentifierType.ISBN13, value: enrichedBook.isbn13, isPrimary: true })
    if (enrichedBook.isbn10) identifiers.push({ identifierTypeId: IdentifierType.ISBN10, value: enrichedBook.isbn10, isPrimary: !enrichedBook.isbn13 })
    if (enrichedBook.issn) identifiers.push({ identifierTypeId: IdentifierType.ISSN, value: enrichedBook.issn })
    if (enrichedBook.lccn) identifiers.push({ identifierTypeId: IdentifierType.LCCN, value: enrichedBook.lccn })
    if (enrichedBook.oclcNumber) identifiers.push({ identifierTypeId: IdentifierType.OCLC, value: enrichedBook.oclcNumber })
    if (enrichedBook.oclcWorkId) identifiers.push({ identifierTypeId: IdentifierType.OCLCWorkId, value: enrichedBook.oclcWorkId })
    if (enrichedBook.doi) identifiers.push({ identifierTypeId: IdentifierType.DOI, value: enrichedBook.doi })
    if (enrichedBook.asin) identifiers.push({ identifierTypeId: IdentifierType.ASIN, value: enrichedBook.asin })
    if (enrichedBook.googleBooksId) identifiers.push({ identifierTypeId: IdentifierType.GoogleBooksId, value: enrichedBook.googleBooksId })
    if (enrichedBook.goodreadsId) identifiers.push({ identifierTypeId: IdentifierType.GoodreadsId, value: enrichedBook.goodreadsId })
    if (enrichedBook.libraryThingId) identifiers.push({ identifierTypeId: IdentifierType.LibraryThingId, value: enrichedBook.libraryThingId })
    if (enrichedBook.olid) identifiers.push({ identifierTypeId: IdentifierType.OpenLibraryId, value: enrichedBook.olid })
    if (enrichedBook.dnbId) identifiers.push({ identifierTypeId: IdentifierType.DNB, value: enrichedBook.dnbId })
    if (enrichedBook.bnfId) identifiers.push({ identifierTypeId: IdentifierType.BNF, value: enrichedBook.bnfId })
    if (enrichedBook.nlaId) identifiers.push({ identifierTypeId: IdentifierType.NLA, value: enrichedBook.nlaId })
    if (enrichedBook.blId) identifiers.push({ identifierTypeId: IdentifierType.BL, value: enrichedBook.blId })
    patchData.identifiers = identifiers
  }

  // Build contributors
  if (hasContributorFields) {
    const contributors: Array<{ displayName: string; roleId: number; ordinal: number }> = []
    let ordinal = 1

    // Authors
    const authorStr = enrichedBook.author || book.author || ''
    for (const name of authorStr.split(/,\s*/).filter(Boolean)) {
      contributors.push({ displayName: name.trim(), roleId: ContributorRole.Author, ordinal: ordinal++ })
    }
    // Other contributors
    if (enrichedBook.editor) {
      for (const name of enrichedBook.editor.split(/,\s*/).filter(Boolean)) {
        contributors.push({ displayName: name.trim(), roleId: ContributorRole.Editor, ordinal: ordinal++ })
      }
    }
    if (enrichedBook.translator) {
      for (const name of enrichedBook.translator.split(/,\s*/).filter(Boolean)) {
        contributors.push({ displayName: name.trim(), roleId: ContributorRole.Translator, ordinal: ordinal++ })
      }
    }
    if (enrichedBook.illustrator) {
      for (const name of enrichedBook.illustrator.split(/,\s*/).filter(Boolean)) {
        contributors.push({ displayName: name.trim(), roleId: ContributorRole.Illustrator, ordinal: ordinal++ })
      }
    }
    if (enrichedBook.narrator) {
      for (const name of enrichedBook.narrator.split(/,\s*/).filter(Boolean)) {
        contributors.push({ displayName: name.trim(), roleId: ContributorRole.Narrator, ordinal: ordinal++ })
      }
    }
    if (contributors.length > 0) {
      patchData.contributors = contributors
    }
  }

  // Build subjects (merge categories + subjects)
  if (hasSubjectFields) {
    const subjectSet = new Set<string>()
    const subjects: Array<{ schemeId: number; text: string }> = []

    // Keep existing subjects
    if (book.subjects) {
      for (const s of book.subjects) {
        const text = typeof s === 'object' ? (s as any).text || String(s) : String(s)
        if (!subjectSet.has(text)) {
          subjectSet.add(text)
          subjects.push({ schemeId: SubjectScheme.LCSH, text })
        }
      }
    }
    // Add new subjects
    if (enrichedBook.subjects) {
      for (const s of enrichedBook.subjects) {
        const text = typeof s === 'object' ? (s as any).text || String(s) : String(s)
        if (!subjectSet.has(text)) {
          subjectSet.add(text)
          subjects.push({ schemeId: SubjectScheme.LCSH, text })
        }
      }
    }
    // Add categories as subjects too
    if (enrichedBook.categories) {
      for (const cat of enrichedBook.categories) {
        const text = typeof cat === 'string' ? cat : String(cat)
        if (!subjectSet.has(text)) {
          subjectSet.add(text)
          subjects.push({ schemeId: SubjectScheme.Custom, text })
        }
      }
    }
    if (subjects.length > 0) {
      patchData.subjects = subjects
    }
  }

  // Build series
  const hasSeriesFields = selectedDiffs.some(d => ['series', 'volumeNumber'].includes(d.key))
  if (hasSeriesFields && enrichedBook.series) {
    patchData.series = {
      name: typeof enrichedBook.series === 'string' ? enrichedBook.series : String(enrichedBook.series),
      volumeNumber: enrichedBook.volumeNumber || null,
    }
  }

  // Stamp enrichment metadata into itemMetadataJson
  const existingItemMeta: Record<string, any> = {}
  // Preserve any existing item metadata fields
  if ((book as any).pln) existingItemMeta.pln = (book as any).pln
  if ((book as any).readCount) existingItemMeta.readCount = (book as any).readCount
  if ((book as any).acquisitionSource) existingItemMeta.acquisitionSource = (book as any).acquisitionSource
  if ((book as any).fromWhere) existingItemMeta.fromWhere = (book as any).fromWhere
  if ((book as any).purchasePrice) existingItemMeta.purchasePrice = (book as any).purchasePrice
  if ((book as any).bookValue) existingItemMeta.bookValue = (book as any).bookValue
  if ((book as any).copies) existingItemMeta.copies = (book as any).copies
  if ((book as any).privateNotes) existingItemMeta.privateNotes = (book as any).privateNotes
  if ((book as any).collections) existingItemMeta.collections = (book as any).collections
  if ((book as any).lendingPatron) existingItemMeta.lendingPatron = (book as any).lendingPatron
  if ((book as any).lendingStatus) existingItemMeta.lendingStatus = (book as any).lendingStatus
  if ((book as any).lendingStart) existingItemMeta.lendingStart = (book as any).lendingStart
  if ((book as any).lendingEnd) existingItemMeta.lendingEnd = (book as any).lendingEnd
  if ((book as any).ltBookId) existingItemMeta.ltBookId = (book as any).ltBookId
  if ((book as any).ltWorkId) existingItemMeta.ltWorkId = (book as any).ltWorkId
  if ((book as any).deweyWording) existingItemMeta.deweyWording = (book as any).deweyWording
  if ((book as any).customFields) existingItemMeta.customFields = (book as any).customFields

  // Add enrichment tracking
  existingItemMeta.enrichedAt = new Date().toISOString()
  existingItemMeta.enrichmentSources = dataSources || _fullApiData.dataSources || []

  patchData.itemMetadataJson = JSON.stringify(existingItemMeta)

  console.log('[Enrichment] PATCH payload for', book.id, JSON.stringify(patchData, null, 2))
  await updateItem(book.id, patchData)
}

/**
 * Format a value for display in the diff UI.
 */
export function formatDiffValue(value: any): string {
  if (isEmpty(value)) return '—'
  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'object' ? (v.text || v.name || JSON.stringify(v)) : String(v)).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.length > 200) return value.substring(0, 200) + '...'
  return String(value)
}
