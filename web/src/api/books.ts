// Import extended API functions
import {
  lookupFromDNB,
  lookupFromBNF,
  lookupFromNLA,
  lookupFromHathiTrust,
  lookupFromInternetArchive,
  lookupFromGoodreads,
  lookupFromAmazon,
  lookupFromThriftBooks,
  lookupFromBetterWorldBooks,
  lookupFromWikidata,
} from './book-apis-extended'
import type { GoogleBooksVolume } from './google-books-types'

// Proxy configuration
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

// Helper function to fetch through proxy for CORS-blocked APIs
async function fetchThroughProxy(url: string, options?: RequestInit): Promise<Response> {
  const proxyUrl = `${PROXY_URL}/proxy?url=${encodeURIComponent(url)}`
  console.log(`🔄 Proxying request: ${url.substring(0, 80)}... via ${PROXY_URL}`)
  return fetch(proxyUrl, options)
}

// Book type definition - comprehensive fields from all sources
export interface Book {
  // Core identification
  id: string
  householdId: string
  title: string
  author: string
  dateAdded: string
  
  // Basic Info (from volumeInfo)
  subtitle?: string
  originalTitle?: string
  coverImageUrl?: string
  coverImageFallbacks?: string[] // Ordered list of fallback cover URLs to try
  description?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  language?: string
  
  // Categories & Classification
  mainCategory?: string
  categories?: string[]
  subjects?: string[]
  deweyDecimal?: string
  deweyEdition?: string // Edition of Dewey system used
  lcc?: string // Library of Congress Classification
  lccEdition?: string // Edition of LC system used
  callNumber?: string
  bisacCodes?: string[] // Book Industry Standards
  thema?: string[] // International subject codes
  fastSubjects?: string[] // FAST (Faceted Application of Subject Terminology)
  
  // Identifiers (from industryIdentifiers)
  isbn?: string // Legacy/general
  isbn10?: string
  isbn13?: string
  issn?: string
  lccn?: string // Library of Congress Control Number
  oclcNumber?: string
  oclcWorkId?: string
  doi?: string // Digital Object Identifier
  asin?: string // Amazon
  googleBooksId?: string
  goodreadsId?: string
  libraryThingId?: string
  olid?: string // Open Library ID
  
  // National Library Identifiers
  dnbId?: string // Deutsche Nationalbibliothek (German National Library)
  bnfId?: string // Bibliothèque nationale de France
  nlaId?: string // National Library of Australia
  ndlId?: string // National Diet Library (Japan)
  lacId?: string // Library and Archives Canada
  blId?: string // British Library
  
  // Contributors
  translator?: string
  illustrator?: string
  editor?: string
  narrator?: string // For audiobooks
  contributors?: Array<{ // Detailed contributor info
    name: string
    role: string // "author", "editor", "translator", "illustrator", etc.
    ordinal?: number
  }>
  
  // Edition & Publication Details
  edition?: string
  editionStatement?: string
  printType?: string // "BOOK" | "MAGAZINE"
  format?: string // Hardcover, Paperback, eBook, Audiobook, etc.
  placeOfPublication?: string
  originalPublicationDate?: string
  copyright?: string
  printingHistory?: string
  
  // Physical Details
  dimensions?: string // Formatted string from height/width/thickness
  dimensionsHeight?: string
  dimensionsWidth?: string
  dimensionsThickness?: string
  weight?: string
  shippingWeight?: string
  binding?: string // Hardcover, Paperback, Mass Market, etc.
  pagination?: string // Detailed page info (e.g., "viii, 342 p.")
  physicalDescription?: string
  
  // Series Information
  series?: string // Legacy field
  seriesInfo?: {
    seriesId?: string
    seriesName?: string
    volumeNumber?: string
  }
  numberOfVolumes?: number
  volumeNumber?: string
  
  // Content & Reading Info
  tableOfContents?: string
  firstSentence?: string
  excerpt?: string
  textSnippet?: string // From searchInfo
  readingAge?: string
  lexileScore?: string
  arLevel?: string // Accelerated Reader level
  maturityRating?: string
  
  // Historical & Theological
  churchHistoryPeriod?: string // Apostolic, Ante-Nicene, Nicene, Post-Nicene, Medieval, Reformation, Enlightenment
  dateWritten?: string // Original composition date (may differ from publication date)
  religiousTradition?: string[] // Catholic, Eastern Orthodox, Protestant, Baptist, etc. (can be multiple)
  
  // Google Books Specific Fields
  etag?: string
  selfLink?: string
  contentVersion?: string
  readingModesText?: boolean
  readingModesImage?: boolean
  allowAnonLogging?: boolean
  panelizationContainsEpubBubbles?: boolean
  panelizationContainsImageBubbles?: boolean
  subtitleLanguage?: string
  otherTitles?: string[]
  canonicalVolumeLink?: string
  
  // Image Links (all sizes from Google Books)
  coverImageSmallThumbnail?: string
  coverImageThumbnail?: string
  coverImageSmall?: string
  coverImageMedium?: string
  coverImageLarge?: string
  coverImageExtraLarge?: string
  
  // Ratings & Reviews
  averageRating?: number
  ratingsCount?: number
  reviewsCount?: number
  reviewsTextCount?: number // Number of text reviews (vs just ratings)
  fiveStarPercent?: number // Percentage of 5-star reviews
  communityRating?: number // From Goodreads or other community sources
  
  // Sale Information
  saleCountry?: string
  saleability?: string // "FOR_SALE" | "NOT_FOR_SALE" | "FREE"
  onSaleDate?: string
  isEbook?: boolean
  listPriceAmount?: number
  listPriceCurrency?: string
  retailPriceAmount?: number
  retailPriceCurrency?: string
  buyLink?: string
  
  // Commercial & Availability (from retailers/WorldCat)
  currentPrice?: number
  discount?: number // Percentage off
  usedPrices?: number[] // Array of used book prices
  availability?: string // "In stock", "Out of stock", etc.
  bestsellerRank?: number
  librariesOwning?: number // How many libraries own this (WorldCat)
  nearbyLibraries?: Array<{ name: string; distance: string }>
  
  // Access Information
  accessCountry?: string
  viewability?: string // "PARTIAL" | "ALL_PAGES" | "NO_PAGES"
  embeddable?: boolean
  publicDomain?: boolean
  textToSpeechPermission?: string
  epubAvailable?: boolean
  epubDownloadLink?: string
  epubAcsTokenLink?: string
  pdfAvailable?: boolean
  pdfDownloadLink?: string
  pdfAcsTokenLink?: string
  webReaderLink?: string
  accessViewStatus?: string
  quoteSharingAllowed?: boolean
  
  // Download Access Details
  downloadRestricted?: boolean
  downloadDeviceAllowed?: boolean
  downloadMaxDevices?: number
  downloadAcquired?: number
  
  // User Information (if user is authenticated with Google)
  isPurchased?: boolean
  isPreordered?: boolean
  userRating?: number
  userReviewText?: string
  userReviewDate?: string
  readingPositionPosition?: string
  readingPositionUpdated?: string
  userInfoUpdated?: string
  
  // Links
  previewLink?: string
  infoLink?: string
  
  // Enhanced content fields
  byStatement?: string // Attribution statement (e.g., "by Jane Austen ; edited by...")
  bibliography?: string // "Includes bibliographical references and index"
  colophon?: string // Publishing/printing details
  printRun?: string // "First printing: 5000 copies"
  
  // Translation details
  originalLanguage?: string
  translatedFrom?: string
  
  // Traditional library catalog fields
  notes?: string
  pln?: string // Physical Location Name (e.g., 'Living Room Bookshelf', 'Office')
  awards?: string[]
  barcode?: string

  // Reading status
  readStatus?: string // e.g., 'Read', 'Unread', 'Reading', 'DNF'
  completedDate?: string // Date finished reading
  dateStarted?: string // Date started reading
  readCount?: number // Number of times read

  // Ownership & Acquisition
  acquiredDate?: string // When the book was acquired
  acquisitionSource?: string // Where acquired from (e.g., 'amazon.com', 'gift')
  fromWhere?: string // Geographic/store where acquired
  purchasePrice?: string // What was paid
  bookValue?: string // Estimated current value
  condition?: string // Physical condition
  copies?: number // Number of copies owned
  privateNotes?: string // Private comments (not shared)
  collections?: string[] // LibraryThing collections

  // Lending
  lendingPatron?: string // Who it's lent to
  lendingStatus?: string // Current lending status
  lendingStart?: string // When lending started
  lendingEnd?: string // When lending ended/is due

  // LibraryThing-specific IDs
  ltBookId?: string // LibraryThing Book ID (for covers)
  ltWorkId?: string // LibraryThing Work ID

  // Classification extras
  deweyWording?: string // Human-readable Dewey description
  
  // Community & Enhanced Metadata
  quotes?: string[] // Memorable quotes from the book
  trivia?: string[] // Interesting facts about the book
  popularShelves?: string[] // Goodreads shelves (to-read, favorites, etc.)
  similarBooks?: string[] // Related/similar book ISBNs or IDs
  
  // Metadata tracking
  dataSources?: string[]
  lastUpdated?: string
  
  // Custom fields (user-defined)
  customFields?: Record<string, any>
}

// Google Books API response type
export interface GoogleBookInfo {
  id?: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    description?: string
    publisher?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    language?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    industryIdentifiers?: Array<{
      type: string
      identifier: string
    }>
    previewLink?: string
    infoLink?: string
    averageRating?: number
    ratingsCount?: number
    printType?: string
    dimensions?: {
      height?: string
      width?: string
      thickness?: string
    }
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Search books in the collection
export async function searchBooks(
  householdId: string,
  query: string = '',
  signal?: AbortSignal
): Promise<Book[]> {
  const params = new URLSearchParams()
  if (query) params.append('q', query)

  const response = await fetch(
    `${API_BASE_URL}/households/${householdId}/books?${params}`,
    { signal }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch books')
  }

  return response.json()
}

// Get book by ID
export async function getBook(householdId: string, bookId: string): Promise<Book> {
  const response = await fetch(
    `${API_BASE_URL}/households/${householdId}/books/${bookId}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch book')
  }

  return response.json()
}

// Add a new book
export async function addBook(householdId: string, book: Omit<Book, 'id' | 'dateAdded'>): Promise<Book> {
  const response = await fetch(
    `${API_BASE_URL}/households/${householdId}/books`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(book),
    }
  )

  if (!response.ok) {
    throw new Error('Failed to add book')
  }

  return response.json()
}

// Update a book
export async function updateBook(
  householdId: string,
  bookId: string,
  book: Partial<Book>
): Promise<Book> {
  const response = await fetch(
    `${API_BASE_URL}/households/${householdId}/books/${bookId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(book),
    }
  )

  if (!response.ok) {
    throw new Error('Failed to update book')
  }

  return response.json()
}

// Delete a book
export async function deleteBook(householdId: string, bookId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/households/${householdId}/books/${bookId}`,
    {
      method: 'DELETE',
    }
  )

  if (!response.ok) {
    throw new Error('Failed to delete book')
  }
}

// ==================== SMART SEARCH OPTIMIZATION ====================

// Helper: Detect if input is an ISBN
function detectISBN(query: string): string | null {
  const cleaned = query.replace(/[-\s]/g, '')
  // ISBN-10: 10 digits
  if (/^\d{10}$/.test(cleaned)) return cleaned
  // ISBN-13: 13 digits
  if (/^\d{13}$/.test(cleaned)) return cleaned
  return null
}

// Helper: Parse "Title by Author" format
export interface SearchHints {
  publisher?: string
  subject?: string
  place?: string
  year?: string
  language?: string
}

function parseQuery(query: string): { title?: string; author?: string; publisher?: string; subject?: string; place?: string; year?: string; language?: string } {
  let remaining = query.trim()
  let publisher: string | undefined
  let subject: string | undefined
  let place: string | undefined
  let year: string | undefined
  let language: string | undefined

  // Extract field: prefixes (support quoted multi-word values)
  const fieldPatterns: Array<{ keys: string[]; field: string }> = [
    { keys: ['publisher', 'pub'], field: 'publisher' },
    { keys: ['subject', 'subj', 'category', 'cat'], field: 'subject' },
    { keys: ['place', 'city'], field: 'place' },
    { keys: ['year', 'yr'], field: 'year' },
    { keys: ['language', 'lang'], field: 'language' },
  ]

  const parsed: Record<string, string> = {}
  for (const fp of fieldPatterns) {
    const keyPattern = fp.keys.join('|')
    const re = new RegExp(`\\s*(?:${keyPattern}):\\s*"([^"]+)"|\\s*(?:${keyPattern}):\\s*(\\S+)`, 'i')
    const m = remaining.match(re)
    if (m) {
      parsed[fp.field] = (m[1] || m[2]).trim()
      remaining = remaining.replace(m[0], '').trim()
    }
  }

  publisher = parsed.publisher
  subject = parsed.subject
  place = parsed.place
  year = parsed.year
  language = parsed.language

  // Extract "by author" pattern
  const byMatch = remaining.match(/^(.+?)\s+by\s+(.+)$/i)
  if (byMatch) {
    return { title: byMatch[1].trim(), author: byMatch[2].trim(), publisher, subject, place, year, language }
  }
  return { title: remaining || undefined, author: undefined, publisher, subject, place, year, language }
}

// Search Open Library by title/author (fast, no rate limits)
async function searchOpenLibrary(title: string, author?: string): Promise<{ isbn?: string; data?: any }> {
  try {
    const params = new URLSearchParams()
    params.append('title', title)
    if (author) params.append('author', author)
    params.append('limit', '5')
    
    const url = `https://openlibrary.org/search.json?${params}`
    console.log('🔍 Searching Open Library:', { title, author })
    
    const response = await fetch(url)
    if (!response.ok) return {}
    
    const data = await response.json()
    if (!data.docs || data.docs.length === 0) return {}
    
    // Get best match (first result)
    const book = data.docs[0]
    
    // Extract best ISBN (prefer ISBN-13)
    const isbn = book.isbn?.find((i: string) => i.length === 13) || book.isbn?.[0]
    
    console.log('✅ Found in Open Library:', book.title, 'ISBN:', isbn)
    
    return { 
      isbn,
      data: {
        title: book.title,
        author: book.author_name?.join(', '),
        publishedDate: book.first_publish_year?.toString(),
        publisher: book.publisher?.[0],
        coverImageUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : undefined,
      }
    }
  } catch (error) {
    console.error('Open Library search error:', error)
    return {}
  }
}

/**
 * Fetch ALL editions of an Open Library work — great for finding older/rare editions.
 * The search endpoint returns works; this drills into a work's editions list.
 */
async function fetchOpenLibraryEditions(workKey: string, limit: number = 30): Promise<Array<{ isbn?: string; data: Partial<Book> }>> {
  try {
    // workKey is like "/works/OL123W" or just "OL123W"
    const key = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`
    const url = `https://openlibrary.org${key}/editions.json?limit=${limit}`
    console.log('📚 Fetching Open Library editions for work:', key)

    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    if (!data.entries || data.entries.length === 0) return []

    return data.entries.map((ed: any) => {
      const isbn13 = ed.isbn_13?.[0]
      const isbn10 = ed.isbn_10?.[0]
      const isbn = isbn13 || isbn10

      return {
        isbn,
        data: {
          title: ed.title,
          subtitle: ed.subtitle,
          author: ed.by_statement,
          publishedDate: ed.publish_date,
          publisher: ed.publishers?.[0],
          placeOfPublication: ed.publish_places?.[0],
          pageCount: ed.number_of_pages,
          isbn13,
          isbn10,
          lccn: ed.lccn?.[0],
          oclcNumber: ed.oclc_numbers?.[0],
          olid: ed.key?.replace('/books/', ''),
          coverImageUrl: ed.covers?.[0] ? `https://covers.openlibrary.org/b/id/${ed.covers[0]}-L.jpg` : undefined,
          language: ed.languages?.[0]?.key?.replace('/languages/', ''),
          format: ed.physical_format,
          binding: ed.physical_format,
          editionStatement: ed.edition_name,
          physicalDescription: ed.pagination,
          dataSources: ['Open Library Editions'],
        }
      }
    })
  } catch (error) {
    console.error('Open Library editions fetch error:', error)
    return []
  }
}

// Search Open Library and return multiple results
async function searchOpenLibraryMultiple(title: string, author?: string, limit: number = 40, publisher?: string, subject?: string, place?: string, year?: string, language?: string): Promise<Array<{ isbn?: string; key?: string; data: Partial<Book> }>> {
  try {
    const params = new URLSearchParams()
    params.append('title', title)
    if (author) params.append('author', author)
    if (publisher) params.append('publisher', publisher)
    if (subject) params.append('subject', subject)
    if (place) params.append('place', place)
    if (year) params.append('first_publish_year', year)
    if (language) params.append('language', language)
    params.append('limit', limit.toString())

    const url = `https://openlibrary.org/search.json?${params}`
    console.log('🔍 Searching Open Library (multiple):', { title, author, limit })

    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    if (!data.docs || data.docs.length === 0) return []

    // Map all results — keep even those without ISBNs (older editions)
    return data.docs.map((book: any) => {
      const isbn = book.isbn?.find((i: string) => i.length === 13) || book.isbn?.[0]
      return {
        isbn,
        key: book.key, // Open Library work key e.g. /works/OL123W
        data: {
          title: book.title,
          author: book.author_name?.join(', '),
          publishedDate: book.first_publish_year?.toString(),
          publisher: book.publisher?.[0],
          pageCount: book.number_of_pages_median,
          coverImageUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : undefined,
          olid: book.key?.replace('/works/', ''),
          dataSources: ['Open Library'],
        }
      }
    })
  } catch (error) {
    console.error('Open Library multiple search error:', error)
    return []
  }
}

// Search Google Books and return multiple results
async function searchGoogleBooksMultiple(title: string, author?: string, limit: number = 40, publisher?: string, subject?: string): Promise<Array<{ isbn?: string; data: Partial<Book> }>> {
  try {
    const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
    let query = title
    if (author) query += ` inauthor:${author}`
    if (publisher) query += ` inpublisher:${publisher}`
    if (subject) query += ` subject:${subject}`
    
    const params = new URLSearchParams()
    params.append('q', query)
    params.append('maxResults', Math.min(limit, 40).toString())
    if (API_KEY) params.append('key', API_KEY)

    const url = `https://www.googleapis.com/books/v1/volumes?${params}`
    console.log('🔍 Searching Google Books (multiple):', { title, author, limit })

    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    if (!data.items || data.items.length === 0) return []

    // Keep all results — even those without ISBNs (older editions)
    return data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo
      const isbn13 = volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier
      const isbn10 = volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier
      const isbn = isbn13 || isbn10

      return {
        isbn,
        data: {
          title: volumeInfo.title,
          subtitle: volumeInfo.subtitle,
          author: volumeInfo.authors?.join(', '),
          publishedDate: volumeInfo.publishedDate,
          publisher: volumeInfo.publisher,
          pageCount: volumeInfo.pageCount,
          description: volumeInfo.description,
          categories: volumeInfo.categories,
          isbn13,
          isbn10,
          googleBooksId: item.id,
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
          language: volumeInfo.language,
          dataSources: ['Google Books'],
        }
      }
    })
  } catch (error) {
    console.error('Google Books multiple search error:', error)
    return []
  }
}

// Fast ISBN lookup using only Google Books + Open Library (CORS-friendly, quick)
async function fastISBNLookup(isbn: string): Promise<Partial<Book> | null> {
  const [google, openLib] = await Promise.all([
    lookupFromGoogleBooks(isbn).catch(() => null),
    lookupFromOpenLibrary(isbn).catch(() => null),
  ])
  if (!google && !openLib) return null
  // Merge: Google first, Open Library fills gaps
  const merged: Partial<Book> = { ...openLib, ...google }
  if (openLib?.description && !google?.description) merged.description = openLib.description
  if (openLib?.subjects && !google?.subjects) merged.subjects = openLib.subjects
  if (openLib?.pageCount && !google?.pageCount) merged.pageCount = openLib.pageCount
  return merged
}

// NEW: Search for multiple book results
export async function searchBookMultiple(
  query: string,
  onProgress?: (current: number, total: number, status: string) => void,
  hints?: SearchHints
): Promise<Array<Partial<Book> & { isbn?: string }>> {
  console.log('🔎 Smart search (multiple results):', query, hints ? `with hints: ${JSON.stringify(hints)}` : '')

  // Stage 1: Detect input type
  const isbn = detectISBN(query)

  if (isbn) {
    // Fast path: Direct ISBN lookup returns single result
    if (onProgress) onProgress(1, 2, 'Looking up ISBN...')
    const result = await fastISBNLookup(isbn)
    if (onProgress) onProgress(2, 2, 'Complete')
    return result ? [{ ...result, isbn }] : []
  }

  // Stage 2: Text search - get multiple results from both APIs
  const { title, author, publisher, subject, place, year, language } = parseQuery(query)

  // Merge form-field hints with parsed query params (parsed takes precedence)
  const pub = publisher || hints?.publisher
  const subj = subject || hints?.subject
  const plc = place || hints?.place
  const yr = year || hints?.year
  const lang = language || hints?.language

  if (onProgress) onProgress(1, 4, 'Searching multiple sources...')

  // Search both Google Books and Open Library in parallel
  const [googleResults, openLibResults] = await Promise.all([
    searchGoogleBooksMultiple(title!, author, 40, pub, subj),
    searchOpenLibraryMultiple(title!, author, 40, pub, subj, plc, yr, lang)
  ])

  if (onProgress) onProgress(2, 4, 'Found results, enriching data...')

  // Combine and deduplicate by ISBN (or by title+author for ISBN-less results)
  const resultsMap = new Map<string, Partial<Book> & { isbn?: string }>()
  let noIsbnCounter = 0

  // Add Google Books results first (usually better quality)
  for (const result of googleResults) {
    const key = result.isbn || `g-${result.data.googleBooksId || `no-isbn-${noIsbnCounter++}`}`
    resultsMap.set(key, { ...result.data, isbn: result.isbn })
  }

  // Merge Open Library results
  for (const result of openLibResults) {
    const key = result.isbn || `ol-${(result as any).key || `no-isbn-${noIsbnCounter++}`}`
    if (result.isbn) {
      const existing = resultsMap.get(result.isbn)
      if (existing) {
        // Merge data from both sources
        resultsMap.set(result.isbn, mergeBookData(existing, result.data, 'Combined'))
      } else {
        resultsMap.set(key, { ...result.data, isbn: result.isbn })
      }
    } else {
      resultsMap.set(key, { ...result.data, isbn: undefined })
    }
  }

  // Stage 3: Fetch editions for the top Open Library work match
  // This finds older/rare editions that don't show up in basic search
  if (onProgress) onProgress(3, 4, 'Fetching older editions...')
  const topOLWork = openLibResults.find(r => (r as any).key)
  if (topOLWork && (topOLWork as any).key) {
    try {
      const editions = await fetchOpenLibraryEditions((topOLWork as any).key, 30)
      for (const ed of editions) {
        const key = ed.isbn || `ol-ed-${noIsbnCounter++}`
        if (ed.isbn && resultsMap.has(ed.isbn)) continue // skip duplicates
        resultsMap.set(key, { ...ed.data, isbn: ed.isbn })
      }
      console.log(`📚 Added ${editions.length} edition variants from Open Library`)
    } catch (e) {
      console.warn('Edition fetch failed, continuing with existing results')
    }
  }

  const results = Array.from(resultsMap.values())

  if (onProgress) onProgress(4, 4, `Found ${results.length} results`)

  console.log(`✅ Found ${results.length} unique books`)
  return results.slice(0, 50) // Return max 50 results
}

// Lookup book info by ISBN using multiple APIs with progress callback
export async function lookupBookByISBN(
  isbn: string, 
  onProgress?: (current: number, total: number, apiName: string) => void
): Promise<Partial<Book> | null> {
  const apis = [
    // CORS-friendly APIs first (work directly from browser)
    { name: 'Google Books', fn: () => lookupFromGoogleBooks(isbn), priority: 1 },
    { name: 'Open Library', fn: () => lookupFromOpenLibrary(isbn), priority: 1 },
    { name: 'CrossRef', fn: () => lookupFromCrossRef(isbn), priority: 2 },
    { name: 'Internet Archive', fn: () => lookupFromInternetArchive(isbn), priority: 2 },
    { name: 'HathiTrust', fn: () => lookupFromHathiTrust(isbn), priority: 2 },
    { name: 'ERIC', fn: () => lookupFromERIC(isbn), priority: 3 },
    { name: 'PubMed', fn: () => lookupFromPubMed(isbn), priority: 3 },
    { name: 'Wikidata', fn: () => lookupFromWikidata(isbn), priority: 2 },
    
    // APIs requiring keys (skip if not configured)
    { name: 'ISBNdb', fn: () => lookupFromISBNdb(isbn), priority: 1 },
    { name: 'DPLA', fn: () => lookupFromDPLA(isbn), priority: 3 },
    { name: 'Europeana', fn: () => lookupFromEuropeana(isbn), priority: 3 },
    { name: 'Trove', fn: () => lookupFromTrove(isbn), priority: 3 },
    { name: 'LibraryThing', fn: () => lookupFromLibraryThing(isbn), priority: 2 },
    
    // May have CORS issues but worth trying
    { name: 'WorldCat', fn: () => lookupFromWorldCat(isbn), priority: 1 },
    { name: 'OCLC Classify', fn: () => lookupFromOCLCClassify(isbn), priority: 2 },
    { name: 'OCLC xISBN', fn: () => lookupFromOCLCxISBN(isbn), priority: 2 },
    { name: 'Library of Congress', fn: () => lookupFromLibraryOfCongress(isbn), priority: 2 },
    { name: 'British Library', fn: () => lookupFromBritishLibrary(isbn), priority: 2 },
    { name: 'Deutsche Nationalbibliothek', fn: () => lookupFromDNB(isbn), priority: 2 },
    { name: 'Bibliothèque nationale de France', fn: () => lookupFromBNF(isbn), priority: 2 },
    { name: 'National Library of Australia', fn: () => lookupFromNLA(isbn), priority: 3 },
    { name: 'National Diet Library Japan', fn: () => lookupFromNDL(isbn), priority: 3 },
    { name: 'DBpedia', fn: () => lookupFromDBpedia(isbn), priority: 3 },
    { name: 'Semantic Scholar', fn: () => lookupFromSemanticScholar(isbn), priority: 3 },
    { name: 'BookBrainz', fn: () => lookupFromBookBrainz(isbn), priority: 3 },
    { name: 'Anobii', fn: () => lookupFromAnobii(isbn), priority: 4 },
    { name: 'Library Hub Discover', fn: () => lookupFromLibraryHub(isbn), priority: 3 },
    
    // Authority file / placeholder
    { name: 'VIAF', fn: () => lookupFromVIAF(isbn), priority: 4 },
    { name: 'COPAC', fn: () => lookupFromCOPAC(isbn), priority: 4 },
    
    // Require scraping or unavailable
    { name: 'Library and Archives Canada', fn: () => lookupFromLAC(isbn), priority: 4 },
    { name: 'National Library of China', fn: () => lookupFromNLC(isbn), priority: 4 },
    { name: 'JSTOR', fn: () => lookupFromJSTOR(isbn), priority: 4 },
    { name: 'Project MUSE', fn: () => lookupFromProjectMUSE(isbn), priority: 4 },
    { name: 'arXiv', fn: () => lookupFromArXiv(isbn), priority: 4 },
    { name: 'Nielsen BookData', fn: () => lookupFromNielsen(isbn), priority: 4 },
    { name: 'Bowker', fn: () => lookupFromBowker(isbn), priority: 4 },
    { name: 'Ingram', fn: () => lookupFromIngram(isbn), priority: 4 },
    { name: 'Baker & Taylor', fn: () => lookupFromBakerTaylor(isbn), priority: 4 },
    { name: 'Goodreads', fn: () => lookupFromGoodreads(isbn), priority: 2 },
    { name: 'Amazon', fn: () => lookupFromAmazon(isbn), priority: 4 },
    { name: 'Barnes & Noble', fn: () => lookupFromBarnesNoble(isbn), priority: 4 },
    { name: 'AbeBooks', fn: () => lookupFromAbeBooks(isbn), priority: 4 },
    { name: 'Alibris', fn: () => lookupFromAlibris(isbn), priority: 4 },
    { name: 'ThriftBooks', fn: () => lookupFromThriftBooks(isbn), priority: 4 },
    { name: 'Better World Books', fn: () => lookupFromBetterWorldBooks(isbn), priority: 4 },
    { name: 'Book Depository', fn: () => lookupFromBookDepository(isbn), priority: 4 },
    { name: 'Indiebound', fn: () => lookupFromIndiebound(isbn), priority: 4 },
    { name: 'Powell\'s Books', fn: () => lookupFromPowells(isbn), priority: 4 },
    { name: 'Biblio', fn: () => lookupFromBiblio(isbn), priority: 4 },
    { name: 'BookFinder', fn: () => lookupFromBookFinder(isbn), priority: 4 },
    { name: 'ISBN Search', fn: () => lookupFromISBNSearch(isbn), priority: 4 },
    { name: 'ISBNPlus', fn: () => lookupFromISBNPlus(isbn), priority: 4 },
  ]

  let mergedBook: Partial<Book> = { dataSources: [] }
  let foundAnyData = false
  const totalApis = apis.length
  let apiIndex = 0

  // Helper to call API with timeout
  const callWithTimeout = async (api: typeof apis[0], timeout = 8000) => {
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), timeout)
    )
    return Promise.race([api.fn(), timeoutPromise])
  }

  // Process APIs in batches by priority (lower priority number = higher importance)
  const priorities = [1, 2, 3, 4]
  
  for (const priority of priorities) {
    const batch = apis.filter(api => api.priority === priority)
    
    // Call batch APIs in parallel
    const results = await Promise.allSettled(
      batch.map(async (api) => {
        apiIndex++
        if (onProgress) {
          onProgress(apiIndex, totalApis, api.name)
        }
        
        try {
          console.log(`Trying ${api.name}...`)
          const result = await callWithTimeout(api)
          return { api, result }
        } catch (error) {
          console.error(`${api.name} failed:`, error)
          return { api, result: null }
        }
      })
    )

    // Process results
    for (const settled of results) {
      if (settled.status === 'fulfilled' && settled.value.result) {
        const { api, result } = settled.value
        foundAnyData = true
        console.log(`✓ Data from ${api.name}:`, Object.keys(result).filter(k => result[k as keyof typeof result]))
        
        // Merge results
        const beforeFields = Object.keys(mergedBook).filter(k => mergedBook[k as keyof typeof mergedBook])
        mergedBook = mergeBookData(mergedBook, result, api.name)
        const afterFields = Object.keys(mergedBook).filter(k => mergedBook[k as keyof typeof mergedBook])
        
        // Track data sources
        if (afterFields.length > beforeFields.length) {
          mergedBook.dataSources = [...new Set([...(mergedBook.dataSources || []), api.name])]
        }
      }
    }

    // Check if we have all important fields after this batch
    const missingFields = getMissingFields(mergedBook)
    if (missingFields.length === 0) {
      console.log('✓ All fields populated, stopping cascade')
      break
    } else if (priority < 4) {
      console.log(`Still missing: ${missingFields.join(', ')} - trying priority ${priority + 1} APIs`)
    }
  }

  if (!foundAnyData) {
    console.log('No results from any API')
    return null
  }

  console.log('Final merged book data:', mergedBook)
  console.log('Data sources:', mergedBook.dataSources)
  return mergedBook
}

// Merge two book objects, preferring non-empty values from source1 but filling gaps from source2
function mergeBookData(source1: Partial<Book>, source2: Partial<Book>, apiName: string): Partial<Book> {
  const merged: Partial<Book> = { ...source1 }
  
  // List of all fields to merge
  const fields: (keyof Book)[] = [
    'title', 'subtitle', 'author', 'originalTitle', 'translatedFrom', 'translator',
    'illustrator', 'editor', 'narrator', 'isbn', 'isbn10', 'isbn13',
    'coverImageUrl', 'description', 'excerpt', 'firstSentence', 'tableOfContents',
    'publisher', 'publishedDate', 'originalPublicationDate', 'placeOfPublication',
    'pageCount', 'format', 'weight', 'dimensions',
    'categories', 'subjects', 'bisacCodes', 'thema',
    'language', 'callNumber', 'deweyDecimal', 'lcc', 'lccn', 'oclcNumber',
    'edition', 'editionStatement', 'printingHistory', 'copyright',
    'physicalDescription', 'series', 'numberOfVolumes', 'volumeNumber',
    'notes', 'readingAge', 'lexileScore', 'arLevel', 'awards',
    'asin', 'goodreadsId', 'libraryThingId', 'googleBooksId', 'olid',
    'oclcWorkId', 'doi', 'averageRating', 'ratingsCount', 'reviewsCount',
    'previewLink', 'infoLink', 'buyLink'
  ]
  
  fields.forEach(field => {
    const value2 = source2[field]
    const value1 = merged[field]
    
    // Fill in if missing
    if (!value1 && value2) {
      console.log(`  + Adding ${field} from ${apiName}`)
      merged[field] = value2 as any
    }
    // For arrays, merge them (remove duplicates)
    else if (Array.isArray(value1) && Array.isArray(value2)) {
      const combined = [...new Set([...value1, ...value2])]
      if (combined.length > value1.length) {
        console.log(`  + Merging ${field} arrays from ${apiName}`)
        merged[field] = combined as any
      }
    }
    // For numbers, prefer higher values (more complete data)
    else if (typeof value1 === 'number' && typeof value2 === 'number' && value2 > value1) {
      console.log(`  + Updating ${field} from ${apiName} (better value)`)
      merged[field] = value2 as any
    }
  })
  
  return merged
}

// Get list of important fields that are still missing
function getMissingFields(book: Partial<Book>): string[] {
  const importantFields: (keyof Book)[] = [
    'title', 'author', 'coverImageUrl', 'description', 'publisher',
    'publishedDate', 'pageCount', 'language', 'callNumber', 'subjects',
    'deweyDecimal', 'lcc', 'subtitle', 'format'
  ]
  
  return importantFields.filter(field => {
    const value = book[field]
    if (!value) return true
    if (Array.isArray(value) && value.length === 0) return true
    return false
  })
}

async function lookupFromGoogleBooks(isbn: string): Promise<Partial<Book> | null> {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${apiKey ? `&key=${apiKey}` : ''}`
    console.log('Looking up ISBN from Google Books:', isbn)
    
    const response = await fetch(url)
    console.log('Google Books response status:', response.status)

    if (response.status === 429) {
      console.warn('Google Books rate limit hit, trying Open Library...')
      return null
    }

    if (!response.ok) {
      console.error('Google Books API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.log('No books found in Google Books for ISBN:', isbn)
      return null
    }

    const bookInfo: GoogleBooksVolume = data.items[0]
    const { volumeInfo, saleInfo, accessInfo, searchInfo, userInfo } = bookInfo

    console.log('Book found in Google Books:', volumeInfo.title)

    // Parse all available fields from the Google Books response
    const book: Partial<Book> = {
      // Core Info
      title: volumeInfo.title || 'Unknown Title',
      subtitle: volumeInfo.subtitle,
      author: volumeInfo.authors?.join(', ') || 'Unknown Author',
      description: volumeInfo.description,
      publisher: volumeInfo.publisher,
      publishedDate: volumeInfo.publishedDate,
      pageCount: volumeInfo.pageCount,
      language: volumeInfo.language || 'en',
      
      // Categories
      mainCategory: volumeInfo.mainCategory,
      categories: volumeInfo.categories,
      
      // Identifiers
      isbn: isbn,
      isbn13: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier,
      isbn10: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier,
      issn: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISSN')?.identifier,
      googleBooksId: bookInfo.id,
      
      // Google Books Metadata
      etag: bookInfo.etag,
      selfLink: bookInfo.selfLink,
      contentVersion: volumeInfo.contentVersion,
      
      // Reading Modes
      readingModesText: volumeInfo.readingModes?.text,
      readingModesImage: volumeInfo.readingModes?.image,
      
      // Print Info
      printType: volumeInfo.printType,
      format: volumeInfo.printType,
      
      // Ratings
      averageRating: volumeInfo.averageRating,
      ratingsCount: volumeInfo.ratingsCount,
      maturityRating: volumeInfo.maturityRating,
      
      // Additional metadata
      allowAnonLogging: volumeInfo.allowAnonLogging,
      subtitleLanguage: volumeInfo.subtitleLanguage,
      otherTitles: volumeInfo.otherTitles,
      
      // Panelization
      panelizationContainsEpubBubbles: volumeInfo.panelizationSummary?.containsEpubBubbles,
      panelizationContainsImageBubbles: volumeInfo.panelizationSummary?.containsImageBubbles,
      
      // Image Links (all sizes)
      coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      coverImageSmallThumbnail: volumeInfo.imageLinks?.smallThumbnail?.replace('http:', 'https:'),
      coverImageThumbnail: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      coverImageSmall: volumeInfo.imageLinks?.small?.replace('http:', 'https:'),
      coverImageMedium: volumeInfo.imageLinks?.medium?.replace('http:', 'https:'),
      coverImageLarge: volumeInfo.imageLinks?.large?.replace('http:', 'https:'),
      coverImageExtraLarge: volumeInfo.imageLinks?.extraLarge?.replace('http:', 'https:'),
      
      // Links
      previewLink: volumeInfo.previewLink,
      infoLink: volumeInfo.infoLink,
      canonicalVolumeLink: volumeInfo.canonicalVolumeLink,
      
      // Dimensions
      dimensionsHeight: volumeInfo.dimensions?.height,
      dimensionsWidth: volumeInfo.dimensions?.width,
      dimensionsThickness: volumeInfo.dimensions?.thickness,
      dimensions: volumeInfo.dimensions 
        ? `${volumeInfo.dimensions.height || '?'} x ${volumeInfo.dimensions.width || '?'} x ${volumeInfo.dimensions.thickness || '?'}`
        : undefined,
      
      // Series Info
      seriesInfo: volumeInfo.seriesInfo ? {
        seriesId: volumeInfo.seriesInfo.seriesId,
        seriesName: volumeInfo.seriesInfo.seriesName,
        volumeNumber: volumeInfo.seriesInfo.volumeNumber,
      } : undefined,
      series: volumeInfo.seriesInfo?.seriesName,
      volumeNumber: volumeInfo.seriesInfo?.volumeNumber,
    }

    // Sale Information
    if (saleInfo) {
      book.saleCountry = saleInfo.country
      book.saleability = saleInfo.saleability
      book.onSaleDate = saleInfo.onSaleDate
      book.isEbook = saleInfo.isEbook
      book.listPriceAmount = saleInfo.listPrice?.amount
      book.listPriceCurrency = saleInfo.listPrice?.currencyCode
      book.retailPriceAmount = saleInfo.retailPrice?.amount
      book.retailPriceCurrency = saleInfo.retailPrice?.currencyCode
      book.buyLink = saleInfo.buyLink
    }

    // Access Information
    if (accessInfo) {
      book.accessCountry = accessInfo.country
      book.viewability = accessInfo.viewability
      book.embeddable = accessInfo.embeddable
      book.publicDomain = accessInfo.publicDomain
      book.textToSpeechPermission = accessInfo.textToSpeechPermission
      book.epubAvailable = accessInfo.epub?.isAvailable
      book.epubDownloadLink = accessInfo.epub?.downloadLink
      book.epubAcsTokenLink = accessInfo.epub?.acsTokenLink
      book.pdfAvailable = accessInfo.pdf?.isAvailable
      book.pdfDownloadLink = accessInfo.pdf?.downloadLink
      book.pdfAcsTokenLink = accessInfo.pdf?.acsTokenLink
      book.webReaderLink = accessInfo.webReaderLink
      book.accessViewStatus = accessInfo.accessViewStatus
      book.quoteSharingAllowed = accessInfo.quoteSharingAllowed
      
      // Download Access
      if (accessInfo.downloadAccess) {
        book.downloadRestricted = accessInfo.downloadAccess.restricted
        book.downloadDeviceAllowed = accessInfo.downloadAccess.deviceAllowed
        book.downloadMaxDevices = accessInfo.downloadAccess.maxDownloadDevices
        book.downloadAcquired = accessInfo.downloadAccess.downloadsAcquired
      }
    }

    // Search Info
    if (searchInfo) {
      book.textSnippet = searchInfo.textSnippet
    }

    // User Info (if authenticated)
    if (userInfo) {
      book.isPurchased = userInfo.isPurchased
      book.isPreordered = userInfo.isPreordered
      book.userRating = userInfo.review?.rating
      book.userReviewText = userInfo.review?.text
      book.userReviewDate = userInfo.review?.date
      book.readingPositionPosition = userInfo.readingPosition?.position
      book.readingPositionUpdated = userInfo.readingPosition?.updated
      book.userInfoUpdated = userInfo.updated
    }

    return book
  } catch (error) {
    console.error('Google Books lookup failed:', error)
    return null
  }
}

async function lookupFromOpenLibrary(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Open Library:', isbn)
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    
    const response = await fetch(url)
    console.log('Open Library response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const bookKey = `ISBN:${isbn}`
    
    if (!data[bookKey]) {
      console.log('No books found in Open Library for ISBN:', isbn)
      return null
    }

    const book = data[bookKey]
    console.log('Book found in Open Library:', book.title)

    // Extract Open Library ID from URLs
    let olid: string | undefined
    if (book.key) {
      const match = book.key.match(/\/works\/(OL\w+)/)
      olid = match?.[1]
    } else if (book.url) {
      const match = book.url.match(/\/works\/(OL\w+)/)
      olid = match?.[1]
    }

    // Try to get extended data including community info
    let communityRating: number | undefined
    let popularShelves: string[] | undefined
    if (olid) {
      try {
        const worksResponse = await fetch(`https://openlibrary.org/works/${olid}.json`)
        if (worksResponse.ok) {
          const worksData = await worksResponse.json()
          // Get ratings from ratings API
          try {
            const ratingsResponse = await fetch(`https://openlibrary.org/works/${olid}/ratings.json`)
            if (ratingsResponse.ok) {
              const ratingsData = await ratingsResponse.json()
              communityRating = ratingsData.summary?.average
            }
          } catch (e) {
            // Ratings optional
          }
          // Get subjects as popular "shelves"
          if (worksData.subjects && Array.isArray(worksData.subjects)) {
            popularShelves = worksData.subjects.slice(0, 10) // Top 10
          }
        }
      } catch (e) {
        // Extended data optional
      }
    }

    return {
      title: book.title || 'Unknown Title',
      author: book.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
      isbn: isbn,
      olid: olid || undefined,
      communityRating: communityRating || undefined,
      popularShelves: popularShelves || undefined,
      description: book.notes || book.subtitle,
      publisher: book.publishers?.map((p: any) => p.name).join(', '),
      publishedDate: book.publish_date,
      pageCount: book.number_of_pages,
      language: 'en',
      coverImageUrl: book.cover?.large || book.cover?.medium || book.cover?.small,
      subjects: book.subjects?.map((s: any) => s.name),
      placeOfPublication: book.publish_places?.map((p: any) => p.name).join(', '),
    }
  } catch (error) {
    console.error('Open Library lookup failed:', error)
    return null
  }
}

async function lookupFromISBNdb(isbn: string): Promise<Partial<Book> | null> {
  try {
    const apiKey = import.meta.env.VITE_ISBNDB_API_KEY
    
    if (!apiKey) {
      console.log('ISBNdb API key not configured, skipping...')
      return null
    }
    
    console.log('Looking up ISBN from ISBNdb:', isbn)
    const url = `https://api2.isbndb.com/book/${isbn}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey
      }
    })
    
    console.log('ISBNdb response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data.book) {
      console.log('No books found in ISBNdb for ISBN:', isbn)
      return null
    }

    const book = data.book
    console.log('Book found in ISBNdb:', book.title)

    return {
      title: book.title || 'Unknown Title',
      author: book.authors?.join(', ') || 'Unknown Author',
      isbn: isbn,
      description: book.synopsis,
      publisher: book.publisher,
      publishedDate: book.date_published,
      pageCount: book.pages,
      language: book.language,
      coverImageUrl: book.image,
      edition: book.edition,
      subjects: book.subjects,
      dimensions: book.dimensions,
      binding: book.binding, // New field: e.g., "Hardcover", "Paperback"
      deweyDecimal: book.dewey_decimal,
      // msrp: book.msrp, // TODO: Add to Book interface if needed
    }
  } catch (error) {
    console.error('ISBNdb lookup failed:', error)
    return null
  }
}

async function lookupFromWorldCat(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from WorldCat:', isbn)
    // WorldCat Search API - public access, no key needed for basic searches
    const url = `http://www.worldcat.org/webservices/catalog/content/isbn/${isbn}?format=json`
    
    const response = await fetchThroughProxy(url)
    console.log('WorldCat response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data.title) {
      console.log('No books found in WorldCat for ISBN:', isbn)
      return null
    }

    console.log('Book found in WorldCat:', data.title)

    return {
      title: data.title || 'Unknown Title',
      author: data.creator || 'Unknown Author',
      isbn: isbn,
      description: data.summary,
      publisher: data.publisher,
      publishedDate: data.date,
      language: data.language || 'en',
      subjects: data.subject ? (Array.isArray(data.subject) ? data.subject : [data.subject]) : undefined,
    }
  } catch (error) {
    console.error('WorldCat lookup failed:', error)
    return null
  }
}

async function lookupFromLibraryOfCongress(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Library of Congress:', isbn)
    
    // Use the public search API instead of the SRU endpoint
    // The SRU endpoint (lx2.loc.gov:210) uses Z39.50 protocol which doesn't work over HTTP
    const url = `https://www.loc.gov/search/?q=${isbn}&fo=json&at=results&c=150`
    
    const response = await fetchThroughProxy(url)
    console.log('Library of Congress response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    // Check if we got results
    if (!data.results || data.results.length === 0) {
      console.log('No books found in Library of Congress for ISBN:', isbn)
      return null
    }

    const result = data.results[0]
    console.log('Book found in Library of Congress:', result.title)

    // Extract available fields
    return {
      title: result.title || 'Unknown Title',
      author: result.contributor?.[0] || 'Unknown Author',
      isbn: isbn,
      publishedDate: result.date,
      placeOfPublication: result.location?.[0],
      publisher: result.contributor?.find((c: string) => c.includes('Publisher')),
      description: result.description?.[0],
      language: result.language?.[0],
    }
  } catch (error) {
    console.error('Library of Congress lookup failed:', error)
    return null
  }
}

async function lookupFromBookBrainz(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from BookBrainz:', isbn)
    // BookBrainz API search
    const searchUrl = `https://bookbrainz.org/search/search?q=${isbn}&collection=edition`
    
    const response = await fetchThroughProxy(searchUrl)
    if (!response.ok) return null

    const data = await response.json()
    
    if (!data || data.length === 0) {
      console.log('No books found in BookBrainz for ISBN:', isbn)
      return null
    }

    const edition = data[0]
    console.log('Book found in BookBrainz:', edition.defaultAlias?.name)

    // Get more details if we have an BBID
    if (edition.bbid) {
      try {
        const detailUrl = `https://bookbrainz.org/edition/${edition.bbid}`
        const detailResponse = await fetch(detailUrl)
        // Would need HTML parsing for full implementation
      } catch (e) {
        // Continue with basic data
      }
    }

    return {
      title: edition.defaultAlias?.name || 'Unknown Title',
      author: edition.authors?.map((a: any) => a.defaultAlias?.name).join(', ') || 'Unknown Author',
      isbn: isbn,
      publishedDate: edition.releaseDate,
      publisher: edition.publishers?.map((p: any) => p.defaultAlias?.name).join(', '),
    }
  } catch (error) {
    console.error('BookBrainz lookup failed:', error)
    return null
  }
}

async function lookupFromOCLCClassify(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from OCLC Classify:', isbn)
    const url = `http://classify.oclc.org/classify2/Classify?isbn=${isbn}&summary=true`
    
    const response = await fetchThroughProxy(url)
    console.log('OCLC Classify response status:', response.status)

    if (!response.ok) {
      return null
    }

    const text = await response.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(text, 'text/xml')
    
    const work = xml.querySelector('work')
    if (!work) {
      console.log('No books found in OCLC Classify for ISBN:', isbn)
      return null
    }

    const title = work.getAttribute('title') || ''
    const author = work.getAttribute('author') || ''
    const owi = work.getAttribute('owi') || '' // OCLC Work Identifier
    
    console.log('Book found in OCLC Classify:', title)

    // Extract Dewey Decimal number and edition
    const deweyPopular = xml.querySelector('recommendations > ddc > mostPopular')
    const dewey = deweyPopular?.getAttribute('nsfa')
    const deweyEdition = deweyPopular?.getAttribute('edition')

    // Extract Library of Congress Classification and edition
    const lccPopular = xml.querySelector('recommendations > lcc > mostPopular')
    const lcc = lccPopular?.getAttribute('nsfa')
    const lccEdition = lccPopular?.getAttribute('edition')

    // Extract FAST subjects (Faceted Application of Subject Terminology)
    const fastElements = xml.querySelectorAll('fast')
    const fastSubjects: string[] = []
    fastElements.forEach(el => {
      const heading = el.getAttribute('heading')
      if (heading) fastSubjects.push(heading)
    })

    return {
      title: title || 'Unknown Title',
      author: author || 'Unknown Author',
      isbn: isbn,
      deweyDecimal: dewey,
      deweyEdition: deweyEdition || undefined,
      lcc: lcc,
      lccEdition: lccEdition || undefined,
      fastSubjects: fastSubjects.length > 0 ? fastSubjects : undefined,
      oclcWorkId: owi || undefined,
      callNumber: dewey ? `DDC: ${dewey}` : undefined,
    }
  } catch (error) {
    console.error('OCLC Classify lookup failed:', error)
    return null
  }
}

async function lookupFromBritishLibrary(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from British Library:', isbn)
    // British Library BNB (British National Bibliography) SPARQL endpoint
    const sparqlQuery = `
      PREFIX bibo: <http://purl.org/ontology/bibo/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      
      SELECT ?book ?title ?author ?publisher ?date WHERE {
        ?book bibo:isbn "${isbn}" .
        OPTIONAL { ?book dct:title ?title }
        OPTIONAL { ?book dct:creator ?author }
        OPTIONAL { ?book dct:publisher ?publisher }
        OPTIONAL { ?book dct:date ?date }
      }
      LIMIT 1
    `
    
    const url = `https://bnb.data.bl.uk/sparql?query=${encodeURIComponent(sparqlQuery)}&output=json`
    
    const response = await fetchThroughProxy(url)
    console.log('British Library response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data.results?.bindings || data.results.bindings.length === 0) {
      console.log('No books found in British Library for ISBN:', isbn)
      return null
    }

    const result = data.results.bindings[0]
    const blId = result.book?.value?.match(/resource\/(.+)$/)?.[1] // Extract BL ID from URI
    console.log('Book found in British Library:', result.title?.value)

    return {
      title: result.title?.value || 'Unknown Title',
      author: result.author?.value || 'Unknown Author',
      isbn: isbn,
      blId: blId, // British Library ID
      publisher: result.publisher?.value,
      publishedDate: result.date?.value,
    }
  } catch (error) {
    console.error('British Library lookup failed:', error)
    return null
  }
}

async function lookupFromLibraryThing(isbn: string): Promise<Partial<Book> | null> {
  try {
    const apiKey = import.meta.env.VITE_LIBRARYTHING_API_KEY
    
    if (!apiKey) {
      console.log('LibraryThing API key not configured, skipping...')
      return null
    }
    
    console.log('Looking up ISBN from LibraryThing:', isbn)
    const url = `https://www.librarything.com/services/rest/1.1/?method=librarything.ck.getwork&isbn=${isbn}&apikey=${apiKey}`
    
    const response = await fetchThroughProxy(url)
    console.log('LibraryThing response status:', response.status)

    if (!response.ok) {
      return null
    }

    const text = await response.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(text, 'text/xml')
    
    const item = xml.querySelector('item')
    if (!item) {
      console.log('No books found in LibraryThing for ISBN:', isbn)
      return null
    }

    const title = item.querySelector('title')?.textContent || ''
    const author = item.querySelector('author')?.textContent || ''
    
    console.log('Book found in LibraryThing:', title)

    return {
      title: title || 'Unknown Title',
      author: author || 'Unknown Author',
      isbn: isbn,
    }
  } catch (error) {
    console.error('LibraryThing lookup failed:', error)
    return null
  }
}

async function lookupFromCrossRef(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from CrossRef:', isbn)
    // CrossRef API - great for academic books and journals
    const url = `https://api.crossref.org/works?filter=isbn:${isbn}&mailto=book-collection@example.com`
    
    const response = await fetchThroughProxy(url, {
      headers: {
        'User-Agent': 'BookCollectionApp/1.0 (mailto:book-collection@example.com)'
      }
    })
    console.log('CrossRef response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data.message || !data.message.items || data.message.items.length === 0) {
      console.log('No books found in CrossRef for ISBN:', isbn)
      return null
    }

    const book = data.message.items[0]
    console.log('Book found in CrossRef:', book.title?.[0])

    return {
      title: Array.isArray(book.title) ? book.title[0] : book.title || 'Unknown Title',
      author: book.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', ') || 'Unknown Author',
      isbn: isbn,
      description: book.abstract,
      publisher: book.publisher || book['container-title']?.[0],
      publishedDate: book.published?.['date-parts']?.[0]?.join('-') || book['published-print']?.['date-parts']?.[0]?.join('-'),
      pageCount: book.page ? (() => {
        const parts = book.page.split('-')
        if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
          return parseInt(parts[1]) - parseInt(parts[0]) + 1
        }
        return undefined
      })() : undefined,
      doi: book.DOI,
      subjects: book.subject,
    }
  } catch (error) {
    console.error('CrossRef lookup failed:', error)
    return null
  }
}

async function lookupFromSemanticScholar(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Semantic Scholar:', isbn)
    // Semantic Scholar API - academic papers and books
    const url = `https://api.semanticscholar.org/graph/v1/paper/ISBN:${isbn}?fields=title,authors,year,abstract,publicationDate,journal,venue`
    
    const response = await fetchThroughProxy(url)
    console.log('Semantic Scholar response status:', response.status)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data || !data.title) {
      console.log('No books found in Semantic Scholar for ISBN:', isbn)
      return null
    }

    console.log('Book found in Semantic Scholar:', data.title)

    return {
      title: data.title || 'Unknown Title',
      author: data.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
      isbn: isbn,
      description: data.abstract,
      publishedDate: data.publicationDate || data.year?.toString(),
      publisher: data.venue || data.journal?.name,
    }
  } catch (error) {
    console.error('Semantic Scholar lookup failed:', error)
    return null
  }
}

// OCLC xISBN - Links related ISBNs
async function lookupFromOCLCxISBN(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from OCLC xISBN:', isbn)
    const url = `http://xisbn.worldcat.org/webservices/xid/isbn/${isbn}?method=getMetadata&format=json&fl=*`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.list || data.list.length === 0) return null

    const book = data.list[0]
    return {
      title: book.title,
      author: book.author,
      isbn: isbn,
      publisher: book.publisher,
      publishedDate: book.year,
      language: book.lang,
      oclcNumber: book.oclcnum,
    }
  } catch (error) {
    console.error('OCLC xISBN lookup failed:', error)
    return null
  }
}

// VIAF - Virtual International Authority File (author/contributor data)
async function lookupFromVIAF(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from VIAF:', isbn)
    // VIAF is primarily for authority records, not books
    // Would need to get author name first, then query VIAF
    console.log('VIAF requires author name for lookup')
    return null
  } catch (error) {
    console.error('VIAF lookup failed:', error)
    return null
  }
}

// National Diet Library (Japan)
async function lookupFromNDL(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from National Diet Library Japan:', isbn)
    const url = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const text = await response.text()
    
    // Parse RSS feed - look for item entries, not channel title
    // Skip the first title which is just "ISBN - NDL Search"
    const titleMatches = text.match(/<title[^>]*>([^<]+)<\/title>/g)
    const titles = titleMatches?.map(m => m.replace(/<\/?title[^>]*>/g, ''))
    
    // First title is channel title, second is actual book (if exists)
    if (!titles || titles.length < 2 || titles[1].includes('NDL Search') || titles[1].includes('国立国会図書館')) {
      console.log('No books found in NDL for ISBN:', isbn)
      return null
    }
    
    const authorMatch = text.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/)
    const publisherMatch = text.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/)
    const dateMatch = text.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/)
    const ndlIdMatch = text.match(/<link[^>]*>https?:\/\/ndlsearch\.ndl\.go\.jp\/books\/([^<]+)<\/link>/)

    console.log('Book found in NDL:', titles[1])

    return {
      title: titles[1] || 'Unknown Title',
      author: authorMatch?.[1],
      publisher: publisherMatch?.[1],
      publishedDate: dateMatch?.[1],
      isbn: isbn,
    }
  } catch (error) {
    console.error('NDL lookup failed:', error)
    return null
  }
}

// Library and Archives Canada
async function lookupFromLAC(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Library and Archives Canada:', isbn)
    const url = `https://www.bac-lac.gc.ca/eng/search/Pages/search.aspx?q=${isbn}`
    
    // Would need scraping
    console.log('LAC requires scraping')
    return null
  } catch (error) {
    console.error('LAC lookup failed:', error)
    return null
  }
}

// National Library of China
async function lookupFromNLC(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from National Library of China:', isbn)
    const url = `http://opac.nlc.cn/F/?func=find-b&request=${isbn}&find_code=ISB`
    
    // Would need scraping and Chinese language parsing
    console.log('NLC requires scraping and Chinese language support')
    return null
  } catch (error) {
    console.error('NLC lookup failed:', error)
    return null
  }
}

// Library Hub Discover (UK & Ireland academic libraries)
async function lookupFromLibraryHub(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Library Hub Discover:', isbn)
    const url = `https://discover.libraryhub.jisc.ac.uk/search?isn=${isbn}&format=json`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    console.log('Library Hub requires authentication')
    return null
  } catch (error) {
    console.error('Library Hub lookup failed:', error)
    return null
  }
}

// COPAC (UK & Irish academic/national libraries)
async function lookupFromCOPAC(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from COPAC:', isbn)
    // COPAC merged into Library Hub Discover
    console.log('COPAC merged into Library Hub Discover')
    return null
  } catch (error) {
    console.error('COPAC lookup failed:', error)
    return null
  }
}

// Trove (National Library of Australia)
async function lookupFromTrove(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Trove:', isbn)
    const apiKey = import.meta.env.VITE_TROVE_API_KEY
    
    if (!apiKey) {
      console.log('Trove API key not configured, skipping...')
      return null
    }

    const url = `https://api.trove.nla.gov.au/v3/result?q=isbn:${isbn}&category=book&encoding=json&key=${apiKey}`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.response?.zone?.[0]?.records?.work) return null

    const work = data.response.zone[0].records.work[0]
    return {
      title: work.title,
      author: work.contributor,
      isbn: isbn,
      publishedDate: work.issued,
      publisher: work.publisher,
    }
  } catch (error) {
    console.error('Trove lookup failed:', error)
    return null
  }
}

// Europeana (European cultural heritage)
async function lookupFromEuropeana(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Europeana:', isbn)
    const apiKey = import.meta.env.VITE_EUROPEANA_API_KEY
    
    if (!apiKey) {
      console.log('Europeana API key not configured, skipping...')
      return null
    }

    const url = `https://api.europeana.eu/record/v2/search.json?wskey=${apiKey}&query=isbn:${isbn}`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.items || data.items.length === 0) return null

    const item = data.items[0]
    return {
      title: item.title?.[0],
      author: item.dcCreator?.[0],
      isbn: isbn,
      publisher: item.dcPublisher?.[0],
      publishedDate: item.year?.[0],
    }
  } catch (error) {
    console.error('Europeana lookup failed:', error)
    return null
  }
}

// DPLA - Digital Public Library of America
async function lookupFromDPLA(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from DPLA:', isbn)
    const apiKey = import.meta.env.VITE_DPLA_API_KEY
    
    if (!apiKey) {
      console.log('DPLA API key not configured, skipping...')
      return null
    }

    const url = `https://api.dp.la/v2/items?sourceResource.identifier=${isbn}&api_key=${apiKey}`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.docs || data.docs.length === 0) return null

    const doc = data.docs[0].sourceResource
    return {
      title: doc.title,
      author: doc.creator?.[0],
      isbn: isbn,
      publisher: doc.publisher?.[0],
      publishedDate: doc.date?.displayDate,
      description: doc.description?.[0],
    }
  } catch (error) {
    console.error('DPLA lookup failed:', error)
    return null
  }
}

// JSTOR (academic articles and books)
async function lookupFromJSTOR(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from JSTOR:', isbn)
    // JSTOR requires institutional access
    console.log('JSTOR requires institutional access')
    return null
  } catch (error) {
    console.error('JSTOR lookup failed:', error)
    return null
  }
}

// Project MUSE (humanities and social sciences)
async function lookupFromProjectMUSE(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Project MUSE:', isbn)
    // Project MUSE requires subscription
    console.log('Project MUSE requires subscription access')
    return null
  } catch (error) {
    console.error('Project MUSE lookup failed:', error)
    return null
  }
}

// ERIC (education research)
async function lookupFromERIC(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from ERIC:', isbn)
    const url = `https://api.ies.ed.gov/eric/?search=isbn:${isbn}&format=json`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.response?.docs || data.response.docs.length === 0) return null

    const doc = data.response.docs[0]
    return {
      title: doc.title,
      author: doc.author,
      isbn: isbn,
      publishedDate: doc.publicationdateyear,
      publisher: doc.publisher,
      description: doc.description,
    }
  } catch (error) {
    console.error('ERIC lookup failed:', error)
    return null
  }
}

// PubMed (medical/life sciences)
async function lookupFromPubMed(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from PubMed:', isbn)
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=books&term=${isbn}[ISBN]&retmode=json`
    
    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) return null

    const searchData = await searchResponse.json()
    if (!searchData.esearchresult?.idlist || searchData.esearchresult.idlist.length === 0) {
      console.log('No books found in PubMed for ISBN:', isbn)
      return null
    }

    // Get book details
    const bookId = searchData.esearchresult.idlist[0]
    const detailUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=books&id=${bookId}&retmode=json`
    
    const detailResponse = await fetch(detailUrl)
    if (!detailResponse.ok) return null

    const detailData = await detailResponse.json()
    const book = detailData.result?.[bookId]
    
    if (!book) return null

    console.log('Book found in PubMed:', book.title)

    return {
      title: book.title || 'Unknown Title',
      author: book.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
      isbn: isbn,
      description: book.abstract,
      publisher: book.publisher,
      publishedDate: book.pubdate || book.epubdate,
    }
  } catch (error) {
    console.error('PubMed lookup failed:', error)
    return null
  }
}

// arXiv (physics, mathematics, computer science preprints)
async function lookupFromArXiv(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from arXiv:', isbn)
    // arXiv doesn't use ISBNs (preprints, not published books)
    console.log('arXiv does not use ISBNs')
    return null
  } catch (error) {
    console.error('arXiv lookup failed:', error)
    return null
  }
}

// Nielsen BookData (UK commercial database)
async function lookupFromNielsen(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Nielsen BookData:', isbn)
    const apiKey = import.meta.env.VITE_NIELSEN_API_KEY
    
    if (!apiKey) {
      console.log('Nielsen BookData API key not configured (commercial service)')
      return null
    }

    // Commercial API, requires paid subscription
    console.log('Nielsen requires paid subscription')
    return null
  } catch (error) {
    console.error('Nielsen lookup failed:', error)
    return null
  }
}

// Bowker (US ISBN agency and commercial database)
async function lookupFromBowker(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Bowker:', isbn)
    const apiKey = import.meta.env.VITE_BOWKER_API_KEY
    
    if (!apiKey) {
      console.log('Bowker API key not configured (commercial service)')
      return null
    }

    // Commercial API, requires paid subscription
    console.log('Bowker requires paid subscription')
    return null
  } catch (error) {
    console.error('Bowker lookup failed:', error)
    return null
  }
}

// Ingram (book distributor)
async function lookupFromIngram(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Ingram:', isbn)
    const apiKey = import.meta.env.VITE_INGRAM_API_KEY
    
    if (!apiKey) {
      console.log('Ingram API key not configured (trade partner access only)')
      return null
    }

    // Requires trade partner relationship
    console.log('Ingram requires trade partner access')
    return null
  } catch (error) {
    console.error('Ingram lookup failed:', error)
    return null
  }
}

// Baker & Taylor (book distributor)
async function lookupFromBakerTaylor(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Baker & Taylor:', isbn)
    const apiKey = import.meta.env.VITE_BAKER_TAYLOR_API_KEY
    
    if (!apiKey) {
      console.log('Baker & Taylor API key not configured (trade partner access only)')
      return null
    }

    // Requires trade partner relationship
    console.log('Baker & Taylor requires trade partner access')
    return null
  } catch (error) {
    console.error('Baker & Taylor lookup failed:', error)
    return null
  }
}

// Anobii (social cataloging site)
async function lookupFromAnobii(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Anobii:', isbn)
    const url = `https://www.anobii.com/api/v1/books/${isbn}`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    console.log('Anobii API may require authentication')
    return null
  } catch (error) {
    console.error('Anobii lookup failed:', error)
    return null
  }
}

// Barnes & Noble
async function lookupFromBarnesNoble(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Barnes & Noble:', isbn)
    // Would need web scraping
    const url = `https://www.barnesandnoble.com/s/${isbn}`
    console.log('Barnes & Noble requires web scraping')
    return null
  } catch (error) {
    console.error('Barnes & Noble lookup failed:', error)
    return null
  }
}

// AbeBooks
async function lookupFromAbeBooks(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from AbeBooks:', isbn)
    const url = `https://www.abebooks.com/servlet/SearchResults?isbn=${isbn}`
    console.log('AbeBooks requires web scraping')
    return null
  } catch (error) {
    console.error('AbeBooks lookup failed:', error)
    return null
  }
}

// Alibris
async function lookupFromAlibris(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Alibris:', isbn)
    const url = `https://www.alibris.com/search/books/isbn/${isbn}`
    console.log('Alibris requires web scraping')
    return null
  } catch (error) {
    console.error('Alibris lookup failed:', error)
    return null
  }
}

// Book Depository
async function lookupFromBookDepository(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Book Depository:', isbn)
    // Book Depository closed in April 2023
    console.log('Book Depository closed in 2023')
    return null
  } catch (error) {
    console.error('Book Depository lookup failed:', error)
    return null
  }
}

// Indiebound (independent bookstores)
async function lookupFromIndiebound(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Indiebound:', isbn)
    const url = `https://www.indiebound.org/search/book?keys=${isbn}`
    console.log('Indiebound requires web scraping')
    return null
  } catch (error) {
    console.error('Indiebound lookup failed:', error)
    return null
  }
}

// Powell's Books
async function lookupFromPowells(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Powell\'s Books:', isbn)
    const url = `https://www.powells.com/searchresults?keyword=${isbn}`
    console.log('Powell\'s requires web scraping')
    return null
  } catch (error) {
    console.error('Powell\'s lookup failed:', error)
    return null
  }
}

// Biblio
async function lookupFromBiblio(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Biblio:', isbn)
    const url = `https://www.biblio.com/search.php?keyisbn=${isbn}`
    console.log('Biblio requires web scraping')
    return null
  } catch (error) {
    console.error('Biblio lookup failed:', error)
    return null
  }
}

// BookFinder
async function lookupFromBookFinder(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from BookFinder:', isbn)
    const url = `https://www.bookfinder.com/search/?isbn=${isbn}`
    console.log('BookFinder requires web scraping')
    return null
  } catch (error) {
    console.error('BookFinder lookup failed:', error)
    return null
  }
}

// DBpedia (structured Wikipedia data)
async function lookupFromDBpedia(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from DBpedia:', isbn)
    const url = `https://dbpedia.org/sparql?query=${encodeURIComponent(`
      SELECT ?book ?title ?author ?abstract WHERE {
        ?book dbo:isbn "${isbn}" .
        OPTIONAL { ?book dbo:title ?title }
        OPTIONAL { ?book dbo:author ?author }
        OPTIONAL { ?book dbo:abstract ?abstract }
      }
    `)}&format=json`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.results?.bindings || data.results.bindings.length === 0) return null

    const binding = data.results.bindings[0]
    return {
      title: binding.title?.value,
      author: binding.author?.value,
      isbn: isbn,
      description: binding.abstract?.value,
    }
  } catch (error) {
    console.error('DBpedia lookup failed:', error)
    return null
  }
}

// ISBN Search (isbntools.com)
async function lookupFromISBNSearch(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from ISBN Search:', isbn)
    const url = `https://isbntools.com/isbn/${isbn}`
    console.log('ISBN Search requires web scraping')
    return null
  } catch (error) {
    console.error('ISBN Search lookup failed:', error)
    return null
  }
}

// ISBNPlus
async function lookupFromISBNPlus(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from ISBNPlus:', isbn)
    const url = `https://www.isbnplus.com/isbn/${isbn}`
    console.log('ISBNPlus requires web scraping')
    return null
  } catch (error) {
    console.error('ISBNPlus lookup failed:', error)
    return null
  }
}
