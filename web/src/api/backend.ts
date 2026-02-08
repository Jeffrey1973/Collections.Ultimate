// Backend API client for Collections Ultimate

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5259'

// TODO: Replace with actual householdId from authentication
const DEV_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000' // Replace with real ID

// Types matching the backend API OpenAPI schema

// ItemKind enum from OpenAPI spec
export enum ItemKind {
  Book = 1,
  Other = 99
}

export interface CreateBookIngestRequest {
  work: {
    title: string
    subtitle?: string
    sortTitle?: string
    description?: string
    originalTitle?: string
    language?: string
    metadata?: Record<string, any> // JSONB for extended work fields
  }
  edition: {
    editionTitle?: string
    editionSubtitle?: string
    publisher?: string
    publishedYear?: number
    pageCount?: number
    description?: string
    format?: string
    binding?: string
    editionStatement?: string
    placeOfPublication?: string
    language?: string
    identifiers: Array<{
      identifierTypeId: number
      value: string
      isPrimary: boolean
    }>
    metadata?: Record<string, any> // JSONB for extended edition fields
  }
  item: {
    title?: string
    subtitle?: string
    notes?: string
    barcode?: string
    location?: string
    status?: string
    condition?: string
    acquiredOn?: string
    price?: number
    readStatus?: string
    completedDate?: string
    dateStarted?: string
    userRating?: number
    metadata?: Record<string, any> // JSONB for extended item fields
  }
  contributors?: Array<{
    personId?: string
    displayName: string
    roleId: number
    ordinal: number
    sortName?: string
    birthYear?: number
    deathYear?: number
  }>
  tags?: string[]
  subjects?: Array<{
    schemeId: number
    text: string
  }>
  series?: {
    name: string
    volumeNumber?: string
    ordinal?: number
  }
}

// Response types from OpenAPI spec
export interface ItemResponse {
  itemId: string
  householdId: string
  editionId?: string
  workId: string
  kind: ItemKind
  barcode?: string
  location?: string
  status?: string
  condition?: string
  acquiredOn?: string
  price?: number
  readStatus?: string
  completedDate?: string
  dateStarted?: string
  userRating?: number
  notes?: string
  title?: string
  subtitle?: string
  work?: WorkResponse
  edition?: EditionResponse
  tags?: string[]
  subjects?: Array<{ schemeId: number; text: string }>
  metadata?: Record<string, any> // JSONB extended fields
}

/** Flat search result returned by the list endpoint */
export interface ItemSearchResponse {
  itemId: string
  workId: string
  editionId?: string
  kind: number
  title: string
  subtitle?: string
  barcode?: string
  location?: string
  status?: string
  condition?: string
  acquiredOn?: string
  price?: number
  readStatus?: string
  completedDate?: string
  dateStarted?: string
  userRating?: number
  createdUtc: string
  workTitle?: string
  authors?: string
  tags?: string[]
  subjects?: string[]
  // Work fields
  workDescription?: string
  originalTitle?: string
  workLanguage?: string
  workMetadataJson?: string
  // Edition fields
  publisher?: string
  publishedYear?: number
  pageCount?: number
  coverImageUrl?: string
  format?: string
  binding?: string
  editionStatement?: string
  placeOfPublication?: string
  editionLanguage?: string
  editionMetadataJson?: string
  // Item metadata
  itemMetadataJson?: string
  notes?: string
  // Identifiers (pipe-delimited "type:value" pairs)
  identifiers?: string
  // Series
  seriesName?: string
  volumeNumber?: string
}

export interface WorkResponse {
  workId: string
  title: string
  subtitle?: string
  sortTitle?: string
  description?: string
  contributors?: ContributorResponse[]
  metadata?: Record<string, any> // JSONB extended fields
}

export interface EditionResponse {
  editionId: string
  workId: string
  editionTitle?: string
  editionSubtitle?: string
  publisher?: string
  publishedYear?: number
  pageCount?: number
  description?: string
  identifiers?: IdentifierResponse[]
  metadata?: Record<string, any> // JSONB extended fields
}

export interface ContributorResponse {
  personId: string
  displayName: string
  sortName?: string
  roleId: number
  roleName?: string
  ordinal: number
  birthYear?: number
  deathYear?: number
}

export interface IdentifierResponse {
  identifierTypeId: number
  identifierTypeName?: string
  value: string
  isPrimary: boolean
}

export interface BookResponse {
  id: string
  householdId: string
  title: string
  subtitle?: string
  authors?: string
  isbn10?: string
  isbn13?: string
  publishedYear?: number
  publisher?: string
  notes?: string
  // ... other fields
}

// IdentifierTypeId enum (based on common library standards)
export const IdentifierType = {
  ISBN10: 1,
  ISBN13: 2,
  LCCN: 3,
  OCLC: 4,
  ISSN: 5,
  DOI: 6,
  ASIN: 7, // Amazon
  GoogleBooksId: 8,
  GoodreadsId: 9,
  LibraryThingId: 10,
  OpenLibraryId: 11,
  DNB: 12, // Deutsche Nationalbibliothek (German)
  BNF: 13, // Bibliothèque nationale de France
  NLA: 14, // National Library of Australia
  NDL: 15, // National Diet Library (Japan)
  LAC: 16, // Library and Archives Canada
  BL: 17, // British Library
  OCLCWorkId: 18, // OCLC Work-level ID
  // Add more as needed
} as const

// Contributor Role IDs (common roles)
export const ContributorRole = {
  Author: 1,
  Editor: 2,
  Translator: 3,
  Illustrator: 4,
  Contributor: 5,
  Narrator: 6, // For audiobooks
  Introduction: 7,
  Foreword: 8,
  Afterword: 9,
  Photographer: 10,
  Designer: 11,
  // Add more as needed
} as const

// Subject Scheme IDs
export const SubjectScheme = {
  LCSH: 1, // Library of Congress Subject Headings
  Dewey: 2,
  Custom: 99,
  // Add more as needed
} as const

/**
 * Map frontend Book interface to backend CreateBookIngestRequest
 * Handles all ~180 fields by placing them in appropriate locations
 */
export function mapBookToIngestRequest(book: any): CreateBookIngestRequest {
  // Helper to extract year from date string
  const extractYear = (dateStr?: string): number | undefined => {
    if (!dateStr) return undefined
    const match = dateStr.match(/\d{4}/)
    return match ? parseInt(match[0]) : undefined
  }

  // Prepare work metadata (fields that apply to all editions)
  const workMetadata: Record<string, any> = {}
  if (book.originalTitle) workMetadata.originalTitle = book.originalTitle
  if (book.mainCategory) workMetadata.mainCategory = book.mainCategory
  if (book.deweyDecimal) workMetadata.deweyDecimal = book.deweyDecimal
  if (book.deweyEdition) workMetadata.deweyEdition = book.deweyEdition
  if (book.lcc) workMetadata.lcc = book.lcc
  if (book.lccEdition) workMetadata.lccEdition = book.lccEdition
  if (book.callNumber) workMetadata.callNumber = book.callNumber
  if (book.bisacCodes) workMetadata.bisacCodes = book.bisacCodes
  if (book.thema) workMetadata.thema = book.thema
  if (book.fastSubjects) workMetadata.fastSubjects = book.fastSubjects
  if (book.tableOfContents) workMetadata.tableOfContents = book.tableOfContents
  if (book.firstSentence) workMetadata.firstSentence = book.firstSentence
  if (book.excerpt) workMetadata.excerpt = book.excerpt
  if (book.readingAge) workMetadata.readingAge = book.readingAge
  if (book.lexileScore) workMetadata.lexileScore = book.lexileScore
  if (book.arLevel) workMetadata.arLevel = book.arLevel
  if (book.averageRating) workMetadata.averageRating = book.averageRating
  if (book.ratingsCount) workMetadata.ratingsCount = book.ratingsCount
  if (book.communityRating) workMetadata.communityRating = book.communityRating
  if (book.seriesInfo) workMetadata.seriesInfo = book.seriesInfo
  if (book.series) workMetadata.series = book.series
  if (book.volumeNumber) workMetadata.volumeNumber = book.volumeNumber
  if (book.numberOfVolumes) workMetadata.numberOfVolumes = book.numberOfVolumes
  
  // Historical & Theological fields
  if (book.churchHistoryPeriod) workMetadata.churchHistoryPeriod = book.churchHistoryPeriod
  if (book.dateWritten) workMetadata.dateWritten = book.dateWritten
  if (book.religiousTradition) workMetadata.religiousTradition = book.religiousTradition

  // Prepare edition metadata (publication-specific fields)
  const editionMetadata: Record<string, any> = {}
  if (book.edition) editionMetadata.edition = book.edition
  if (book.editionStatement) editionMetadata.editionStatement = book.editionStatement
  if (book.printType) editionMetadata.printType = book.printType
  if (book.format) editionMetadata.format = book.format
  if (book.binding) editionMetadata.binding = book.binding
  if (book.placeOfPublication) editionMetadata.placeOfPublication = book.placeOfPublication
  if (book.originalPublicationDate) editionMetadata.originalPublicationDate = book.originalPublicationDate
  if (book.copyright) editionMetadata.copyright = book.copyright
  if (book.printingHistory) editionMetadata.printingHistory = book.printingHistory
  if (book.dimensions) editionMetadata.dimensions = book.dimensions
  if (book.dimensionsHeight) editionMetadata.dimensionsHeight = book.dimensionsHeight
  if (book.dimensionsWidth) editionMetadata.dimensionsWidth = book.dimensionsWidth
  if (book.dimensionsThickness) editionMetadata.dimensionsThickness = book.dimensionsThickness
  if (book.weight) editionMetadata.weight = book.weight
  if (book.shippingWeight) editionMetadata.shippingWeight = book.shippingWeight
  if (book.pagination) editionMetadata.pagination = book.pagination
  if (book.physicalDescription) editionMetadata.physicalDescription = book.physicalDescription
  if (book.language) editionMetadata.language = book.language
  if (book.maturityRating) editionMetadata.maturityRating = book.maturityRating
  
  // Cover images
  if (book.coverImageUrl) editionMetadata.coverImageUrl = book.coverImageUrl
  if (book.coverImageSmallThumbnail) editionMetadata.coverImageSmallThumbnail = book.coverImageSmallThumbnail
  if (book.coverImageThumbnail) editionMetadata.coverImageThumbnail = book.coverImageThumbnail
  if (book.coverImageSmall) editionMetadata.coverImageSmall = book.coverImageSmall
  if (book.coverImageMedium) editionMetadata.coverImageMedium = book.coverImageMedium
  if (book.coverImageLarge) editionMetadata.coverImageLarge = book.coverImageLarge
  if (book.coverImageExtraLarge) editionMetadata.coverImageExtraLarge = book.coverImageExtraLarge
  
  // Google Books specific
  if (book.etag) editionMetadata.etag = book.etag
  if (book.selfLink) editionMetadata.selfLink = book.selfLink
  if (book.contentVersion) editionMetadata.contentVersion = book.contentVersion
  if (book.canonicalVolumeLink) editionMetadata.canonicalVolumeLink = book.canonicalVolumeLink
  if (book.readingModesText !== undefined) editionMetadata.readingModesText = book.readingModesText
  if (book.readingModesImage !== undefined) editionMetadata.readingModesImage = book.readingModesImage
  if (book.allowAnonLogging !== undefined) editionMetadata.allowAnonLogging = book.allowAnonLogging
  if (book.textSnippet) editionMetadata.textSnippet = book.textSnippet
  
  // Sale information
  if (book.saleCountry) editionMetadata.saleCountry = book.saleCountry
  if (book.saleability) editionMetadata.saleability = book.saleability
  if (book.onSaleDate) editionMetadata.onSaleDate = book.onSaleDate
  if (book.isEbook !== undefined) editionMetadata.isEbook = book.isEbook
  if (book.listPriceAmount) editionMetadata.listPriceAmount = book.listPriceAmount
  if (book.listPriceCurrency) editionMetadata.listPriceCurrency = book.listPriceCurrency
  if (book.retailPriceAmount) editionMetadata.retailPriceAmount = book.retailPriceAmount
  if (book.retailPriceCurrency) editionMetadata.retailPriceCurrency = book.retailPriceCurrency
  if (book.buyLink) editionMetadata.buyLink = book.buyLink
  
  // Access information
  if (book.viewability) editionMetadata.viewability = book.viewability
  if (book.embeddable !== undefined) editionMetadata.embeddable = book.embeddable
  if (book.publicDomain !== undefined) editionMetadata.publicDomain = book.publicDomain
  if (book.textToSpeechPermission) editionMetadata.textToSpeechPermission = book.textToSpeechPermission
  if (book.epubAvailable !== undefined) editionMetadata.epubAvailable = book.epubAvailable
  if (book.pdfAvailable !== undefined) editionMetadata.pdfAvailable = book.pdfAvailable
  if (book.webReaderLink) editionMetadata.webReaderLink = book.webReaderLink

  // Prepare item metadata (instance-specific fields)
  const itemMetadata: Record<string, any> = {}
  if (book.currentPrice) itemMetadata.currentPrice = book.currentPrice
  if (book.discount) itemMetadata.discount = book.discount
  if (book.usedPrices) itemMetadata.usedPrices = book.usedPrices
  if (book.availability) itemMetadata.availability = book.availability
  if (book.bestsellerRank) itemMetadata.bestsellerRank = book.bestsellerRank
  if (book.librariesOwning) itemMetadata.librariesOwning = book.librariesOwning
  if (book.nearbyLibraries) itemMetadata.nearbyLibraries = book.nearbyLibraries
  
  // Physical location name
  if (book.pln) itemMetadata.pln = book.pln

  // Reading status — promoted to real columns
  if (book.readCount) itemMetadata.readCount = book.readCount

  // Ownership & Acquisition — acquiredDate promoted to acquiredOn real column
  if (book.acquisitionSource) itemMetadata.acquisitionSource = book.acquisitionSource
  if (book.fromWhere) itemMetadata.fromWhere = book.fromWhere
  if (book.purchasePrice) itemMetadata.purchasePrice = book.purchasePrice
  if (book.bookValue) itemMetadata.bookValue = book.bookValue
  if (book.copies) itemMetadata.copies = book.copies
  if (book.privateNotes) itemMetadata.privateNotes = book.privateNotes
  if (book.collections) itemMetadata.collections = book.collections

  // Lending
  if (book.lendingPatron) itemMetadata.lendingPatron = book.lendingPatron
  if (book.lendingStatus) itemMetadata.lendingStatus = book.lendingStatus
  if (book.lendingStart) itemMetadata.lendingStart = book.lendingStart
  if (book.lendingEnd) itemMetadata.lendingEnd = book.lendingEnd

  // LibraryThing IDs
  if (book.ltBookId) itemMetadata.ltBookId = book.ltBookId
  if (book.ltWorkId) itemMetadata.ltWorkId = book.ltWorkId

  // Classification extras
  if (book.deweyWording) itemMetadata.deweyWording = book.deweyWording

  // Custom fields
  if (book.customFields) itemMetadata.customFields = book.customFields

  // Build identifiers array
  const identifiers: Array<{ identifierTypeId: number; value: string; isPrimary: boolean }> = []
  
  if (book.isbn13) {
    identifiers.push({ identifierTypeId: IdentifierType.ISBN13, value: book.isbn13, isPrimary: true })
  }
  if (book.isbn10) {
    identifiers.push({ identifierTypeId: IdentifierType.ISBN10, value: book.isbn10, isPrimary: !book.isbn13 })
  }
  if (book.isbn && !book.isbn13 && !book.isbn10) {
    identifiers.push({
      identifierTypeId: book.isbn.length === 13 ? IdentifierType.ISBN13 : IdentifierType.ISBN10,
      value: book.isbn,
      isPrimary: true
    })
  }
  if (book.issn) identifiers.push({ identifierTypeId: IdentifierType.ISSN, value: book.issn, isPrimary: false })
  if (book.lccn) identifiers.push({ identifierTypeId: IdentifierType.LCCN, value: book.lccn, isPrimary: false })
  if (book.oclcNumber) identifiers.push({ identifierTypeId: IdentifierType.OCLC, value: book.oclcNumber, isPrimary: false })
  if (book.oclcWorkId) identifiers.push({ identifierTypeId: IdentifierType.OCLCWorkId, value: book.oclcWorkId, isPrimary: false })
  if (book.doi) identifiers.push({ identifierTypeId: IdentifierType.DOI, value: book.doi, isPrimary: false })
  if (book.asin) identifiers.push({ identifierTypeId: IdentifierType.ASIN, value: book.asin, isPrimary: false })
  if (book.googleBooksId) identifiers.push({ identifierTypeId: IdentifierType.GoogleBooksId, value: book.googleBooksId, isPrimary: false })
  if (book.goodreadsId) identifiers.push({ identifierTypeId: IdentifierType.GoodreadsId, value: book.goodreadsId, isPrimary: false })
  if (book.libraryThingId) identifiers.push({ identifierTypeId: IdentifierType.LibraryThingId, value: book.libraryThingId, isPrimary: false })
  if (book.olid) identifiers.push({ identifierTypeId: IdentifierType.OpenLibraryId, value: book.olid, isPrimary: false })
  if (book.dnbId) identifiers.push({ identifierTypeId: IdentifierType.DNB, value: book.dnbId, isPrimary: false })
  if (book.bnfId) identifiers.push({ identifierTypeId: IdentifierType.BNF, value: book.bnfId, isPrimary: false })
  if (book.nlaId) identifiers.push({ identifierTypeId: IdentifierType.NLA, value: book.nlaId, isPrimary: false })
  if (book.ndlId) identifiers.push({ identifierTypeId: IdentifierType.NDL, value: book.ndlId, isPrimary: false })
  if (book.lacId) identifiers.push({ identifierTypeId: IdentifierType.LAC, value: book.lacId, isPrimary: false })
  if (book.blId) identifiers.push({ identifierTypeId: IdentifierType.BL, value: book.blId, isPrimary: false })

  // Build contributors array
  const contributors: Array<{
    displayName: string
    roleId: number
    ordinal: number
    sortName?: string
  }> = []

  // Primary author(s)
  if (book.author) {
    const authors = book.author.split(/[,;&]/).map((a: string) => a.trim()).filter((a: string) => a)
    authors.forEach((name: string, index: number) => {
      contributors.push({
        displayName: name,
        roleId: ContributorRole.Author,
        ordinal: contributors.length + 1,
        sortName: name
      })
    })
  }

  // Additional contributors
  if (book.translator) {
    const translators = book.translator.split(/[,;&]/).map((t: string) => t.trim()).filter((t: string) => t)
    translators.forEach((name: string) => {
      contributors.push({
        displayName: name,
        roleId: ContributorRole.Translator,
        ordinal: contributors.length + 1,
        sortName: name
      })
    })
  }

  if (book.illustrator) {
    const illustrators = book.illustrator.split(/[,;&]/).map((i: string) => i.trim()).filter((i: string) => i)
    illustrators.forEach((name: string) => {
      contributors.push({
        displayName: name,
        roleId: ContributorRole.Illustrator,
        ordinal: contributors.length + 1,
        sortName: name
      })
    })
  }

  if (book.editor) {
    const editors = book.editor.split(/[,;&]/).map((e: string) => e.trim()).filter((e: string) => e)
    editors.forEach((name: string) => {
      contributors.push({
        displayName: name,
        roleId: ContributorRole.Editor,
        ordinal: contributors.length + 1,
        sortName: name
      })
    })
  }

  if (book.narrator) {
    const narrators = book.narrator.split(/[,;&]/).map((n: string) => n.trim()).filter((n: string) => n)
    narrators.forEach((name: string) => {
      contributors.push({
        displayName: name,
        roleId: ContributorRole.Narrator,
        ordinal: contributors.length + 1,
        sortName: name
      })
    })
  }

  // Detailed contributors array
  if (book.contributors?.length > 0) {
    book.contributors.forEach((contrib: any) => {
      const roleMap: Record<string, number> = {
        'author': ContributorRole.Author,
        'editor': ContributorRole.Editor,
        'translator': ContributorRole.Translator,
        'illustrator': ContributorRole.Illustrator,
        'narrator': ContributorRole.Narrator,
        'introduction': ContributorRole.Introduction,
        'foreword': ContributorRole.Foreword,
        'afterword': ContributorRole.Afterword,
      }
      
      const roleId = roleMap[contrib.role?.toLowerCase()] || ContributorRole.Contributor
      
      contributors.push({
        displayName: contrib.name,
        roleId,
        ordinal: contrib.ordinal || contributors.length + 1,
        sortName: contrib.name
      })
    })
  }

  // Build subjects array
  const subjects: Array<{ schemeId: number; text: string }> = []
  if (book.subjects?.length > 0) {
    book.subjects.forEach((subject: string) => {
      subjects.push({
        schemeId: SubjectScheme.LCSH,
        text: subject
      })
    })
  }

  return {
    work: {
      title: book.title || 'Untitled',
      subtitle: book.subtitle,
      sortTitle: book.title,
      description: book.description,
      originalTitle: book.originalTitle,
      language: book.language,
      metadata: Object.keys(workMetadata).length > 0 ? workMetadata : undefined
    },
    edition: {
      editionTitle: book.title,
      editionSubtitle: book.subtitle,
      publisher: book.publisher,
      publishedYear: extractYear(book.publishedDate),
      pageCount: book.pageCount,
      description: book.description,
      format: book.format,
      binding: book.binding,
      editionStatement: book.editionStatement,
      placeOfPublication: book.placeOfPublication,
      language: book.language,
      identifiers,
      metadata: Object.keys(editionMetadata).length > 0 ? editionMetadata : undefined
    },
    item: {
      title: book.title,
      subtitle: book.subtitle,
      notes: book.notes,
      barcode: book.isbn || book.isbn13 || book.isbn10,
      location: book.location,
      status: book.status,
      condition: book.condition,
      acquiredOn: book.acquiredDate || book.dateAdded,
      price: book.price,
      readStatus: book.readStatus,
      completedDate: book.completedDate,
      dateStarted: book.dateStarted,
      userRating: book.userRating,
      metadata: Object.keys(itemMetadata).length > 0 ? itemMetadata : undefined
    },
    contributors: contributors.length > 0 ? contributors : undefined,
    tags: book.categories || [],
    subjects: subjects.length > 0 ? subjects : undefined,
    series: book.series ? {
      name: book.series,
      volumeNumber: book.volumeNumber,
      ordinal: undefined
    } : undefined
  }
}

/**
 * Create a new book in the library
 */
export async function createBook(
  data: CreateBookIngestRequest,
  householdId: string = DEV_HOUSEHOLD_ID
): Promise<BookResponse> {
  console.log('📤 Creating book:', {
    url: `${API_BASE_URL}/api/households/${householdId}/library/books`,
    data: JSON.stringify(data, null, 2)
  })

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/households/${householdId}/library/books`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      }
    )

    console.log('📥 Response status:', response.status, response.statusText)

    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      if (contentType?.includes('application/json')) {
        const errorData = await response.json()
        console.error('❌ API Error (JSON):', errorData)
        errorMessage = JSON.stringify(errorData, null, 2)
      } else {
        const errorText = await response.text()
        console.error('❌ API Error (Text):', errorText)
        errorMessage = errorText || errorMessage
      }
      
      throw new Error(`Failed to create book: ${errorMessage}`)
    }

    const result = await response.json()
    console.log('✅ Book created successfully:', result)
    return result
  } catch (error: any) {
    console.error('❌ Network error:', error)
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Is it running on http://localhost:5258? Check for CORS issues.')
    }
    throw error
  }
}

/**
 * Get all books for a household
 */
export async function getBooks(
  householdId: string = DEV_HOUSEHOLD_ID,
  params?: {
    q?: string
    take?: number
    skip?: number
  }
): Promise<BookResponse[]> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.take) queryParams.append('take', params.take.toString())
  if (params?.skip) queryParams.append('skip', params.skip.toString())

  const url = `${API_BASE_URL}/api/households/${householdId}/books${
    queryParams.toString() ? `?${queryParams}` : ''
  }`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to fetch books')
  }

  return response.json()
}

/**
 * Get all items for a household (more comprehensive than books)
 */
export async function getItems(
  householdId: string = DEV_HOUSEHOLD_ID,
  params?: {
    q?: string
    tag?: string
    subject?: string
    barcode?: string
    status?: string
    location?: string
    take?: number
    skip?: number
  }
): Promise<ItemSearchResponse[]> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.tag) queryParams.append('tag', params.tag)
  if (params?.subject) queryParams.append('subject', params.subject)
  if (params?.barcode) queryParams.append('barcode', params.barcode)
  if (params?.status) queryParams.append('status', params.status)
  if (params?.location) queryParams.append('location', params.location)
  if (params?.take) queryParams.append('take', params.take.toString())
  if (params?.skip) queryParams.append('skip', params.skip.toString())

  const url = `${API_BASE_URL}/api/households/${householdId}/items${
    queryParams.toString() ? `?${queryParams}` : ''
  }`

  console.log('📤 Fetching items:', url)

  const response = await fetch(url)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Failed to fetch items:', errorText)
    throw new Error('Failed to fetch items')
  }

  const data = await response.json()
  console.log('✅ Items loaded:', data)
  return data
}

/**
 * Get a single item by ID
 */
export async function getItem(itemId: string): Promise<ItemResponse> {
  const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch item')
  }

  return response.json()
}

/**
 * Get a work by ID
 */
export async function getWork(workId: string): Promise<WorkResponse> {
  const response = await fetch(`${API_BASE_URL}/api/works/${workId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch work')
  }

  return response.json()
}

/**
 * Get an edition by ID
 */
export async function getEdition(editionId: string): Promise<EditionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/editions/${editionId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch edition')
  }

  return response.json()
}

/**
 * Get cover image URL for an edition
 */
export function getEditionCoverUrl(editionId: string): string {
  return `${API_BASE_URL}/api/editions/${editionId}/cover`
}

/**
 * Update an item
 */
export async function updateItem(
  itemId: string,
  data: {
    barcode?: string
    location?: string
    status?: string
    condition?: string
    acquiredOn?: string
    price?: number
    notes?: string
    tags?: string[]
    readStatus?: string
    completedDate?: string
    dateStarted?: string
    userRating?: number
  }
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to update item')
  }
}

/**
 * Move an item from one household to another.
 * Since the backend PATCH doesn't support changing householdId,
 * we re-create the book in the target household, then delete the original.
 *
 * Builds the CreateBookIngestRequest DIRECTLY from the raw ItemResponse
 * (avoids the lossy round-trip through mapItemResponseToBook → mapBookToIngestRequest).
 */
export async function moveItemToHousehold(
  itemId: string,
  targetHouseholdId: string
): Promise<void> {
  // 1. Fetch the full item data (raw response)
  const resp = await fetch(`${API_BASE_URL}/api/items/${itemId}`)
  if (!resp.ok) throw new Error('Failed to fetch item for move')
  const raw: any = await resp.json()

  console.log('📦 Moving item', raw.title, 'to household', targetHouseholdId)

  // 2. Build ingest request directly from the raw JSON
  //    The API response has contributors, identifiers, subjects, series at the TOP level,
  //    NOT nested inside work/edition as the TS types suggest.
  const ingestRequest: CreateBookIngestRequest = {
    work: {
      title: raw.work?.title || raw.title || 'Untitled',
      subtitle: raw.work?.subtitle || raw.subtitle,
      sortTitle: raw.work?.sortTitle,
      description: raw.work?.description,
      originalTitle: raw.work?.originalTitle,
      language: raw.work?.language,
      metadata: raw.work?.metadataJson ? JSON.parse(raw.work.metadataJson) : raw.work?.metadata,
    },
    edition: {
      editionTitle: raw.edition?.editionTitle,
      editionSubtitle: raw.edition?.editionSubtitle,
      publisher: raw.edition?.publisher,
      publishedYear: raw.edition?.publishedYear,
      pageCount: raw.edition?.pageCount,
      description: raw.edition?.description,
      format: raw.edition?.format,
      binding: raw.edition?.binding,
      editionStatement: raw.edition?.editionStatement,
      placeOfPublication: raw.edition?.placeOfPublication,
      language: raw.edition?.language,
      // Identifiers: top-level in response, or nested inside edition
      identifiers: (raw.identifiers || raw.edition?.identifiers || []).map((id: any) => ({
        identifierTypeId: id.identifierTypeId,
        value: id.value,
        isPrimary: id.isPrimary,
      })),
      metadata: raw.edition?.metadataJson ? JSON.parse(raw.edition.metadataJson) : raw.edition?.metadata,
    },
    item: {
      title: raw.title,
      subtitle: raw.subtitle,
      notes: raw.notes,
      barcode: raw.barcode,
      location: raw.location,
      // Don't copy status — item starts fresh in new household
      condition: raw.condition,
      acquiredOn: raw.acquiredOn,
      price: raw.price,
      readStatus: raw.readStatus,
      completedDate: raw.completedDate,
      dateStarted: raw.dateStarted,
      userRating: raw.userRating,
      metadata: raw.metadataJson ? JSON.parse(raw.metadataJson) : raw.metadata,
    },
    // Contributors: top-level in response, or nested inside work
    contributors: (raw.contributors || raw.work?.contributors || []).map((c: any) => ({
      personId: c.personId,
      displayName: c.displayName,
      roleId: c.roleId,
      ordinal: c.ordinal,
      sortName: c.sortName,
      birthYear: c.birthYear,
      deathYear: c.deathYear,
    })),
    // Tags: top-level, may be strings or objects
    tags: (raw.tags || []).map((t: any) => typeof t === 'string' ? t : (t.name || t.tagName || t.text || String(t))),
    // Subjects: top-level, need schemeId + text
    subjects: (raw.subjects || []).map((s: any) => ({
      schemeId: s.schemeId,
      text: s.text,
    })),
    // Series: top-level
    series: raw.series ? {
      name: raw.series.name || raw.series.seriesName,
      volumeNumber: raw.series.volumeNumber,
      ordinal: raw.series.ordinal,
    } : undefined,
  }

  console.log('📤 Move ingest request:', JSON.stringify(ingestRequest, null, 2))

  // 3. Create the book in the target household
  await createBook(ingestRequest, targetHouseholdId)

  // 4. Delete the original item permanently
  await hardDeleteItem(itemId)

  console.log('✅ Move complete — book created in target & original deleted')
}

/** Soft-delete: set item status to 'Previously Owned' */
export async function softDeleteItem(itemId: string): Promise<void> {
  return updateItem(itemId, { status: 'Previously Owned' })
}

/** Restore a soft-deleted item back to active */
export async function restoreItem(itemId: string): Promise<void> {
  return updateItem(itemId, { status: '' })
}

/** Hard delete: permanently remove item (via POST to delete endpoint or PATCH status) */
export async function hardDeleteItem(itemId: string): Promise<void> {
  // Try DELETE endpoint first; if not available, mark as 'Deleted'
  const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
    method: 'DELETE',
  })
  if (response.status === 404 || response.status === 405) {
    // No DELETE endpoint — use status marker
    return updateItem(itemId, { status: 'Deleted' })
  }
  if (!response.ok) {
    throw new Error('Failed to delete item')
  }
}

/**
 * Map an ItemSearchResponse (from the list endpoint) to a frontend Book object.
 * The list endpoint now returns comprehensive data including work/edition fields,
 * metadata JSON, identifiers, tags, subjects, and series.
 */
export function mapSearchResultToBook(item: ItemSearchResponse): any {
  // Parse metadata JSON blobs
  const workMetadata = parseJson(item.workMetadataJson)
  const editionMetadata = parseJson(item.editionMetadataJson)
  const itemMetadata = parseJson(item.itemMetadataJson)

  // Parse identifiers from "type:value||type:value" format
  const identifiers = parseIdentifiers(item.identifiers)

  // Cover URL — stored URL > metadata > Google Books > Open Library fallback by ISBN
  const isbn13 = identifiers[IdentifierType.ISBN13]
  const isbn10 = identifiers[IdentifierType.ISBN10]
  const coverIsbn = isbn13 || isbn10 || item.barcode

  // Build ordered list of all possible cover URLs
  const coverCandidates: string[] = [
    item.coverImageUrl,
    editionMetadata.coverImageUrl,
    editionMetadata.coverImageMedium,
    editionMetadata.coverImageThumbnail,
    editionMetadata.coverImageSmallThumbnail,
    coverIsbn ? `https://books.google.com/books/content?vid=isbn:${coverIsbn}&printsec=frontcover&img=1&zoom=1` : undefined,
    coverIsbn ? `https://covers.openlibrary.org/b/isbn/${coverIsbn}-M.jpg?default=false` : undefined,
  ].filter((u): u is string => !!u)

  const coverImageUrl = coverCandidates[0]
  const coverImageFallbacks = coverCandidates.slice(1)

  return {
    // Core identification
    id: item.itemId,
    workId: item.workId,
    householdId: undefined, // not in list response
    title: item.title || item.workTitle || 'Untitled',
    subtitle: item.subtitle,
    author: item.authors || 'Unknown Author',
    dateAdded: item.acquiredOn || item.createdUtc || new Date().toISOString(),

    // Basic Info
    originalTitle: item.originalTitle || workMetadata.originalTitle,
    coverImageUrl,
    coverImageFallbacks,
    description: item.workDescription,
    publisher: item.publisher,
    publishedDate: item.publishedYear ? `${item.publishedYear}` : undefined,
    pageCount: item.pageCount,
    language: item.editionLanguage || item.workLanguage || editionMetadata.language,

    // Edition
    edition: editionMetadata.edition,
    editionStatement: item.editionStatement || editionMetadata.editionStatement,
    format: item.format || editionMetadata.format,
    binding: item.binding || editionMetadata.binding,
    placeOfPublication: item.placeOfPublication || editionMetadata.placeOfPublication,
    printType: editionMetadata.printType,

    // Physical
    dimensions: editionMetadata.dimensions,
    dimensionsHeight: editionMetadata.dimensionsHeight,
    dimensionsWidth: editionMetadata.dimensionsWidth,
    dimensionsThickness: editionMetadata.dimensionsThickness,
    weight: editionMetadata.weight,
    shippingWeight: editionMetadata.shippingWeight,
    pagination: editionMetadata.pagination,
    physicalDescription: editionMetadata.physicalDescription,

    // Categories & Classification
    mainCategory: workMetadata.mainCategory,
    categories: item.tags || [],
    subjects: item.subjects || [],
    deweyDecimal: workMetadata.deweyDecimal,
    deweyEdition: workMetadata.deweyEdition,
    lcc: workMetadata.lcc,
    lccEdition: workMetadata.lccEdition,
    callNumber: workMetadata.callNumber,
    bisacCodes: workMetadata.bisacCodes,
    thema: workMetadata.thema,
    fastSubjects: workMetadata.fastSubjects,

    // Identifiers
    isbn: identifiers[IdentifierType.ISBN13] || identifiers[IdentifierType.ISBN10] || item.barcode,
    isbn10: identifiers[IdentifierType.ISBN10],
    isbn13: identifiers[IdentifierType.ISBN13],
    issn: identifiers[IdentifierType.ISSN],
    lccn: identifiers[IdentifierType.LCCN],
    oclcNumber: identifiers[IdentifierType.OCLC],
    oclcWorkId: identifiers[IdentifierType.OCLCWorkId],
    doi: identifiers[IdentifierType.DOI],
    asin: identifiers[IdentifierType.ASIN],
    googleBooksId: identifiers[IdentifierType.GoogleBooksId],
    goodreadsId: identifiers[IdentifierType.GoodreadsId],
    libraryThingId: identifiers[IdentifierType.LibraryThingId],
    olid: identifiers[IdentifierType.OpenLibraryId],
    dnbId: identifiers[IdentifierType.DNB],
    bnfId: identifiers[IdentifierType.BNF],
    nlaId: identifiers[IdentifierType.NLA],
    ndlId: identifiers[IdentifierType.NDL],
    lacId: identifiers[IdentifierType.LAC],
    blId: identifiers[IdentifierType.BL],

    // Series
    series: item.seriesName,
    seriesInfo: item.seriesName ? `${item.seriesName}${item.volumeNumber ? ` #${item.volumeNumber}` : ''}` : workMetadata.seriesInfo,
    volumeNumber: item.volumeNumber || workMetadata.volumeNumber,
    numberOfVolumes: workMetadata.numberOfVolumes,

    // Item fields
    barcode: item.barcode,
    location: item.location,
    pln: itemMetadata.pln,
    readStatus: item.readStatus || itemMetadata.readStatus,
    completedDate: item.completedDate || itemMetadata.completedDate,
    dateStarted: item.dateStarted || itemMetadata.dateStarted,
    readCount: itemMetadata.readCount,
    userRating: item.userRating,
    status: item.status,
    condition: item.condition || itemMetadata.condition,
    price: item.price,
    notes: item.notes,

    // Ownership & Acquisition
    acquiredDate: item.acquiredOn || itemMetadata.acquiredDate,
    acquisitionSource: itemMetadata.acquisitionSource,
    fromWhere: itemMetadata.fromWhere,
    purchasePrice: itemMetadata.purchasePrice,
    bookValue: itemMetadata.bookValue,
    copies: itemMetadata.copies,
    privateNotes: itemMetadata.privateNotes,
    collections: itemMetadata.collections,

    // Lending
    lendingPatron: itemMetadata.lendingPatron,
    lendingStatus: itemMetadata.lendingStatus,
    lendingStart: itemMetadata.lendingStart,
    lendingEnd: itemMetadata.lendingEnd,

    // LibraryThing IDs
    ltBookId: itemMetadata.ltBookId,
    ltWorkId: itemMetadata.ltWorkId,

    // Classification extras
    deweyWording: itemMetadata.deweyWording,

    // Content
    tableOfContents: workMetadata.tableOfContents,
    firstSentence: workMetadata.firstSentence,
    excerpt: workMetadata.excerpt,

    // Ratings & Reading level
    readingAge: workMetadata.readingAge,
    lexileScore: workMetadata.lexileScore,
    arLevel: workMetadata.arLevel,
    averageRating: workMetadata.averageRating,
    ratingsCount: workMetadata.ratingsCount,
    communityRating: workMetadata.communityRating,

    // Historical & Theological
    churchHistoryPeriod: workMetadata.churchHistoryPeriod,
    dateWritten: workMetadata.dateWritten,
    religiousTradition: workMetadata.religiousTradition,

    // Publication dates
    originalPublicationDate: editionMetadata.originalPublicationDate,
    copyright: editionMetadata.copyright,
    printingHistory: editionMetadata.printingHistory,
    maturityRating: editionMetadata.maturityRating,

    // Cover images (multiple sizes from metadata)
    coverImageSmallThumbnail: editionMetadata.coverImageSmallThumbnail,
    coverImageThumbnail: editionMetadata.coverImageThumbnail,
    coverImageSmall: editionMetadata.coverImageSmall,
    coverImageMedium: editionMetadata.coverImageMedium,
    coverImageLarge: editionMetadata.coverImageLarge,
    coverImageExtraLarge: editionMetadata.coverImageExtraLarge,

    // Google Books specific
    etag: editionMetadata.etag,
    selfLink: editionMetadata.selfLink,
    contentVersion: editionMetadata.contentVersion,
    canonicalVolumeLink: editionMetadata.canonicalVolumeLink,
    textSnippet: editionMetadata.textSnippet,

    // Sale info
    saleCountry: editionMetadata.saleCountry,
    saleability: editionMetadata.saleability,
    onSaleDate: editionMetadata.onSaleDate,
    isEbook: editionMetadata.isEbook,
    listPriceAmount: editionMetadata.listPriceAmount,
    listPriceCurrency: editionMetadata.listPriceCurrency,
    retailPriceAmount: editionMetadata.retailPriceAmount,
    retailPriceCurrency: editionMetadata.retailPriceCurrency,
    buyLink: editionMetadata.buyLink,

    // Access info
    viewability: editionMetadata.viewability,
    embeddable: editionMetadata.embeddable,
    publicDomain: editionMetadata.publicDomain,
    textToSpeechPermission: editionMetadata.textToSpeechPermission,
    epubAvailable: editionMetadata.epubAvailable,
    pdfAvailable: editionMetadata.pdfAvailable,
    webReaderLink: editionMetadata.webReaderLink,
    readingModesText: editionMetadata.readingModesText,
    readingModesImage: editionMetadata.readingModesImage,
    allowAnonLogging: editionMetadata.allowAnonLogging,

    // Item metadata
    currentPrice: itemMetadata.currentPrice,
    discount: itemMetadata.discount,
    usedPrices: itemMetadata.usedPrices,
    availability: itemMetadata.availability,
    bestsellerRank: itemMetadata.bestsellerRank,
    librariesOwning: itemMetadata.librariesOwning,
    nearbyLibraries: itemMetadata.nearbyLibraries,
    customFields: itemMetadata.customFields,
  }
}

/** Safely parse a JSON string, returning {} on failure */
function parseJson(json?: string): Record<string, any> {
  if (!json) return {}
  try { return JSON.parse(json) }
  catch { return {} }
}

/** Parse pipe-delimited "type:value" identifier string into a lookup map */
function parseIdentifiers(raw?: string): Record<number, string> {
  if (!raw) return {}
  const map: Record<number, string> = {}
  raw.split('||').forEach(pair => {
    const colonIndex = pair.indexOf(':')
    if (colonIndex > 0) {
      const typeId = parseInt(pair.substring(0, colonIndex))
      const value = pair.substring(colonIndex + 1)
      if (!isNaN(typeId) && value) {
        // Keep first (primary) identifier for each type
        if (!map[typeId]) map[typeId] = value
      }
    }
  })
  return map
}

/**
 * Map backend ItemResponse to frontend Book interface
 * Extracts all fields from structured data and metadata JSONB
 */
export function mapItemResponseToBook(item: ItemResponse): any {
  
  // Extract work details
  const title = item.title || item.work?.title || 'Untitled'
  const subtitle = item.subtitle || item.work?.subtitle
  const description = item.work?.description || item.edition?.description
  
  // Handle author field - backend returns flat 'authors' field OR nested contributors
  let author = 'Unknown Author'
  
  // Check for flat authors field first (current backend structure)
  if ((item as any).authors) {
    author = (item as any).authors
    console.log('✍️ Author from flat authors field:', author)
  } else if ((item as any).workTitle && (item as any).authors) {
    // Also check workTitle structure
    author = (item as any).authors
    console.log('✍️ Author from workTitle structure:', author)
  } else if ((item as any).work?.authors) {
    // Check work object for authors field
    author = (item as any).work.authors
    console.log('✍️ Author from work.authors field:', author)
  } else if (item.work?.contributors && item.work.contributors.length > 0) {
    // Extract from nested contributors array
    const contributors = item.work.contributors.sort((a, b) => a.ordinal - b.ordinal)
    author = contributors
      .filter(c => c.roleId === ContributorRole.Author)
      .map(c => c.displayName)
      .join(', ')
    if (author) {
      console.log('✍️ Author from work.contributors array:', author)
    } else {
      // If no authors in contributors, try to get any contributor
      author = contributors.map(c => c.displayName).join(', ') || 'Unknown Author'
      console.log('✍️ Author from any contributors:', author)
    }
  } else {
    console.warn('⚠️ No author found in any location, using "Unknown Author"')
  }
  
  // Extract other contributors (only if we have the full structure)
  const contributors = item.work?.contributors?.sort((a, b) => a.ordinal - b.ordinal) || []
  
  const translator = contributors
    .filter(c => c.roleId === ContributorRole.Translator)
    .map(c => c.displayName)
    .join(', ') || undefined
  
  const illustrator = contributors
    .filter(c => c.roleId === ContributorRole.Illustrator)
    .map(c => c.displayName)
    .join(', ') || undefined
  
  const editor = contributors
    .filter(c => c.roleId === ContributorRole.Editor)
    .map(c => c.displayName)
    .join(', ') || undefined
  
  const narrator = contributors
    .filter(c => c.roleId === ContributorRole.Narrator)
    .map(c => c.displayName)
    .join(', ') || undefined

  // Extract identifiers
  const identifiers = item.edition?.identifiers || []
  const isbn13 = identifiers.find(id => id.identifierTypeId === IdentifierType.ISBN13)?.value
  const isbn10 = identifiers.find(id => id.identifierTypeId === IdentifierType.ISBN10)?.value
  
  // Fallback: use barcode as ISBN if identifiers not present
  const barcodeValue = item.barcode
  const isbnFromBarcode = barcodeValue && barcodeValue.match(/^\d{10,13}$/) ? barcodeValue : undefined
  const finalIsbn13 = isbn13 || (isbnFromBarcode && isbnFromBarcode.length === 13 ? isbnFromBarcode : undefined)
  const finalIsbn10 = isbn10 || (isbnFromBarcode && isbnFromBarcode.length === 10 ? isbnFromBarcode : undefined)
  
  const issn = identifiers.find(id => id.identifierTypeId === IdentifierType.ISSN)?.value
  const lccn = identifiers.find(id => id.identifierTypeId === IdentifierType.LCCN)?.value
  const oclcNumber = identifiers.find(id => id.identifierTypeId === IdentifierType.OCLC)?.value
  const oclcWorkId = identifiers.find(id => id.identifierTypeId === IdentifierType.OCLCWorkId)?.value
  const doi = identifiers.find(id => id.identifierTypeId === IdentifierType.DOI)?.value
  const asin = identifiers.find(id => id.identifierTypeId === IdentifierType.ASIN)?.value
  const googleBooksId = identifiers.find(id => id.identifierTypeId === IdentifierType.GoogleBooksId)?.value
  const goodreadsId = identifiers.find(id => id.identifierTypeId === IdentifierType.GoodreadsId)?.value
  const libraryThingId = identifiers.find(id => id.identifierTypeId === IdentifierType.LibraryThingId)?.value
  const olid = identifiers.find(id => id.identifierTypeId === IdentifierType.OpenLibraryId)?.value
  const dnbId = identifiers.find(id => id.identifierTypeId === IdentifierType.DNB)?.value
  const bnfId = identifiers.find(id => id.identifierTypeId === IdentifierType.BNF)?.value
  const nlaId = identifiers.find(id => id.identifierTypeId === IdentifierType.NLA)?.value
  const ndlId = identifiers.find(id => id.identifierTypeId === IdentifierType.NDL)?.value
  const lacId = identifiers.find(id => id.identifierTypeId === IdentifierType.LAC)?.value
  const blId = identifiers.find(id => id.identifierTypeId === IdentifierType.BL)?.value

  // Extract edition details
  const publisher = item.edition?.publisher
  const publishedYear = item.edition?.publishedYear
  const pageCount = item.edition?.pageCount
  
  // Extract work metadata
  const workMetadata = item.work?.metadata || {}
  const editionMetadata = item.edition?.metadata || {}
  const itemMetadata = item.metadata || {}

  // Generate cover URL - stored URL > metadata > Google Books > Open Library fallback by ISBN
  const coverIsbn = finalIsbn13 || finalIsbn10 || isbnFromBarcode

  // Build ordered list of all possible cover URLs
  const coverCandidates2: string[] = [
    item.edition?.coverImageUrl,
    editionMetadata.coverImageUrl,
    editionMetadata.coverImageMedium,
    editionMetadata.coverImageThumbnail,
    editionMetadata.coverImageSmallThumbnail,
    coverIsbn ? `https://books.google.com/books/content?vid=isbn:${coverIsbn}&printsec=frontcover&img=1&zoom=1` : undefined,
    coverIsbn ? `https://covers.openlibrary.org/b/isbn/${coverIsbn}-M.jpg?default=false` : undefined,
  ].filter((u): u is string => !!u)

  const coverImageUrl = coverCandidates2[0]
  const coverImageFallbacks = coverCandidates2.slice(1)

  // Build comprehensive Book object
  return {
    // Core identification
    id: item.itemId,
    householdId: item.householdId,
    title,
    author,
    dateAdded: item.acquiredOn || new Date().toISOString(),
    
    // Basic Info
    subtitle,
    originalTitle: workMetadata.originalTitle,
    coverImageUrl,
    coverImageFallbacks,
    description,
    publisher,
    publishedDate: publishedYear ? `${publishedYear}` : undefined,
    pageCount,
    language: editionMetadata.language,
    
    // Categories & Classification
    mainCategory: workMetadata.mainCategory,
    categories: (() => {
      const tags = item.tags?.map((tag: any) => {
        if (typeof tag === 'string') return tag
        if (tag && typeof tag === 'object') {
          return tag.name || tag.tagName || tag.text || tag.value || JSON.stringify(tag)
        }
        return String(tag)
      }) || []
      // Also pull categories from work metadata if tags are empty
      if (tags.length === 0 && workMetadata.mainCategory) {
        return [workMetadata.mainCategory]
      }
      return tags
    })(),
    subjects: item.subjects?.map((s: any) => s.text) || [],
    deweyDecimal: workMetadata.deweyDecimal,
    deweyEdition: workMetadata.deweyEdition,
    lcc: workMetadata.lcc,
    lccEdition: workMetadata.lccEdition,
    callNumber: workMetadata.callNumber,
    bisacCodes: workMetadata.bisacCodes,
    thema: workMetadata.thema,
    fastSubjects: workMetadata.fastSubjects,
    
    // Identifiers
    isbn: finalIsbn13 || finalIsbn10 || isbnFromBarcode,
    isbn10: finalIsbn10,
    isbn13: finalIsbn13,
    issn,
    lccn,
    oclcNumber,
    oclcWorkId,
    doi,
    asin,
    googleBooksId,
    goodreadsId,
    libraryThingId,
    olid,
    dnbId,
    bnfId,
    nlaId,
    ndlId,
    lacId,
    blId,
    
    // Contributors
    translator,
    illustrator,
    editor,
    narrator,
    contributors: contributors.map(c => ({
      name: c.displayName,
      role: Object.keys(ContributorRole).find(k => ContributorRole[k as keyof typeof ContributorRole] === c.roleId)?.toLowerCase() || 'contributor',
      ordinal: c.ordinal
    })),
    
    // Edition & Publication Details
    edition: editionMetadata.edition,
    editionStatement: editionMetadata.editionStatement,
    printType: editionMetadata.printType,
    format: editionMetadata.format,
    binding: editionMetadata.binding,
    placeOfPublication: editionMetadata.placeOfPublication,
    originalPublicationDate: editionMetadata.originalPublicationDate,
    copyright: editionMetadata.copyright,
    printingHistory: editionMetadata.printingHistory,
    
    // Physical Details
    dimensions: editionMetadata.dimensions,
    dimensionsHeight: editionMetadata.dimensionsHeight,
    dimensionsWidth: editionMetadata.dimensionsWidth,
    dimensionsThickness: editionMetadata.dimensionsThickness,
    weight: editionMetadata.weight,
    shippingWeight: editionMetadata.shippingWeight,
    pagination: editionMetadata.pagination,
    physicalDescription: editionMetadata.physicalDescription,
    
    // Series Information
    series: workMetadata.series,
    seriesInfo: workMetadata.seriesInfo,
    volumeNumber: workMetadata.volumeNumber,
    numberOfVolumes: workMetadata.numberOfVolumes,
    
    // Content & Reading Info
    tableOfContents: workMetadata.tableOfContents,
    firstSentence: workMetadata.firstSentence,
    excerpt: workMetadata.excerpt,
    textSnippet: editionMetadata.textSnippet,
    readingAge: workMetadata.readingAge,
    lexileScore: workMetadata.lexileScore,
    arLevel: workMetadata.arLevel,
    maturityRating: editionMetadata.maturityRating,
    
    // Historical & Theological
    churchHistoryPeriod: workMetadata.churchHistoryPeriod,
    dateWritten: workMetadata.dateWritten,
    religiousTradition: workMetadata.religiousTradition,
    
    // Google Books Specific
    etag: editionMetadata.etag,
    selfLink: editionMetadata.selfLink,
    contentVersion: editionMetadata.contentVersion,
    canonicalVolumeLink: editionMetadata.canonicalVolumeLink,
    readingModesText: editionMetadata.readingModesText,
    readingModesImage: editionMetadata.readingModesImage,
    allowAnonLogging: editionMetadata.allowAnonLogging,
    
    // Image Links
    coverImageSmallThumbnail: editionMetadata.coverImageSmallThumbnail,
    coverImageThumbnail: editionMetadata.coverImageThumbnail,
    coverImageSmall: editionMetadata.coverImageSmall,
    coverImageMedium: editionMetadata.coverImageMedium,
    coverImageLarge: editionMetadata.coverImageLarge,
    coverImageExtraLarge: editionMetadata.coverImageExtraLarge,
    
    // Ratings & Reviews
    averageRating: workMetadata.averageRating,
    ratingsCount: workMetadata.ratingsCount,
    communityRating: workMetadata.communityRating,
    
    // Sale Information
    saleCountry: editionMetadata.saleCountry,
    saleability: editionMetadata.saleability,
    onSaleDate: editionMetadata.onSaleDate,
    isEbook: editionMetadata.isEbook,
    listPriceAmount: editionMetadata.listPriceAmount,
    listPriceCurrency: editionMetadata.listPriceCurrency,
    retailPriceAmount: editionMetadata.retailPriceAmount,
    retailPriceCurrency: editionMetadata.retailPriceCurrency,
    buyLink: editionMetadata.buyLink,
    
    // Commercial & Availability
    currentPrice: itemMetadata.currentPrice,
    discount: itemMetadata.discount,
    usedPrices: itemMetadata.usedPrices,
    availability: itemMetadata.availability,
    bestsellerRank: itemMetadata.bestsellerRank,
    librariesOwning: itemMetadata.librariesOwning,
    nearbyLibraries: itemMetadata.nearbyLibraries,
    
    // Access Information
    viewability: editionMetadata.viewability,
    embeddable: editionMetadata.embeddable,
    publicDomain: editionMetadata.publicDomain,
    textToSpeechPermission: editionMetadata.textToSpeechPermission,
    epubAvailable: editionMetadata.epubAvailable,
    pdfAvailable: editionMetadata.pdfAvailable,
    webReaderLink: editionMetadata.webReaderLink,
    
    // User-Specific
    location: item.location,
    pln: itemMetadata.pln,
    readStatus: item.readStatus || itemMetadata.readStatus,
    completedDate: item.completedDate || itemMetadata.completedDate,
    dateStarted: item.dateStarted || itemMetadata.dateStarted,
    readCount: itemMetadata.readCount,
    userRating: item.userRating,
    status: item.status,
    condition: item.condition || itemMetadata.condition,
    notes: item.notes,
    price: item.price,

    // Ownership & Acquisition
    acquiredDate: item.acquiredOn || itemMetadata.acquiredDate,
    acquisitionSource: itemMetadata.acquisitionSource,
    fromWhere: itemMetadata.fromWhere,
    purchasePrice: itemMetadata.purchasePrice,
    bookValue: itemMetadata.bookValue,
    copies: itemMetadata.copies,
    privateNotes: itemMetadata.privateNotes,
    collections: itemMetadata.collections,

    // Lending
    lendingPatron: itemMetadata.lendingPatron,
    lendingStatus: itemMetadata.lendingStatus,
    lendingStart: itemMetadata.lendingStart,
    lendingEnd: itemMetadata.lendingEnd,

    // LibraryThing IDs
    ltBookId: itemMetadata.ltBookId,
    ltWorkId: itemMetadata.ltWorkId,

    // Classification extras
    deweyWording: itemMetadata.deweyWording,
    
    // Custom Fields
    customFields: itemMetadata.customFields
  }
}

/**
 * Get all households (no account ID needed)
 */
export async function getAllHouseholds(): Promise<any[]> {
  console.log('📤 Fetching all households from:', `${API_BASE_URL}/api/households`)
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/households`)

    console.log('📥 Households response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Failed to fetch households:', error)
      throw new Error('Failed to fetch households')
    }

    const data = await response.json()
    console.log('✅ Households loaded (raw):', data)
    
    // Extract the ID value from the object structure
    const households = data.map((household: any) => {
      // Backend returns ID as {value: "guid-string"}
      const id = household.id?.value || household.id
      
      console.log('Household:', household.name, 'ID:', id)
      
      return {
        id: id,
        name: household.name
      }
    })
    
    console.log('✅ Households processed:', households)
    return households
  } catch (error: any) {
    console.error('❌ Network error fetching households:', error)
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Is it running on http://localhost:5258? Check for CORS issues.')
    }
    throw error
  }
}

/**
 * Get all households for an account
 */
export async function getHouseholds(accountId: string): Promise<any[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/households`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch households')
  }

  return response.json()
}

/**
 * Create a new household
 */
export async function createHousehold(name: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/households`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error('Failed to create household')
  }

  return response.json()
}
