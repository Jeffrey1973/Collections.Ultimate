// API client for books
// This connects to your CollectionsUltimate.Api backend

const API_BASE = '/api'

export interface Book {
  id: string
  title: string
  subtitle?: string
  authors?: string
  isbn10?: string
  isbn13?: string
  publisher?: string
  publishedYear?: number
  notes?: string
  status?: string
  location?: string
  condition?: string
}

export interface CreateBookRequest {
  title: string
  subtitle?: string
  authors?: string
  isbn10?: string
  isbn13?: string
  publisher?: string
  publishedYear?: number
  notes?: string
}

export async function searchBooks(householdId: string, query?: string): Promise<Book[]> {
  const params = new URLSearchParams()
  if (query) {
    params.set('q', query)
  }
  params.set('take', '50')

  const url = `${API_BASE}/households/${householdId}/books?${params}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to search books: ${response.status}`)
  }

  return response.json()
}

export async function createBook(householdId: string, book: CreateBookRequest): Promise<Book> {
  const response = await fetch(`${API_BASE}/households/${householdId}/books`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(book),
  })

  if (!response.ok) {
    throw new Error(`Failed to create book: ${response.status}`)
  }

  return response.json()
}

export async function getBook(bookId: string): Promise<Book | null> {
  const response = await fetch(`${API_BASE}/books/${bookId}`)
  
  if (response.status === 404) {
    return null
  }
  
  if (!response.ok) {
    throw new Error(`Failed to get book: ${response.status}`)
  }

  return response.json()
}
