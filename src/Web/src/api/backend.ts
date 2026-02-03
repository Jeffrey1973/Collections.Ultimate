// Backend API client for Collections Ultimate

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5258'

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
  }
  edition: {
    editionTitle?: string
    editionSubtitle?: string
    publisher?: string
    publishedYear?: number
    pageCount?: number
    description?: string
    identifiers: Array<{
      identifierTypeId: number
      value: string
      isPrimary: boolean
    }>
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
  notes?: string
  title?: string
  subtitle?: string
  work?: WorkResponse
  edition?: EditionResponse
  tags?: string[]
}

export interface WorkResponse {
  workId: string
  title: string
  subtitle?: string
  sortTitle?: string
  description?: string
  contributors?: ContributorResponse[]
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
  // Add more as needed
} as const

// Contributor Role IDs (common roles)
export const ContributorRole = {
  Author: 1,
  Editor: 2,
  Translator: 3,
  Illustrator: 4,
  Contributor: 5,
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
): Promise<ItemResponse[]> {
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
