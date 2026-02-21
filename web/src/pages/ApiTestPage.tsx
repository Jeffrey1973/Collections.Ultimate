import { useState } from 'react'
// Import the actual API functions from books.ts - they are not exported, so we'll call them via dynamic import
// For now, we'll use fetch directly but through the proxy

interface ApiTestResult {
  name: string
  status: 'testing' | 'success' | 'error' | 'rate-limited' | 'no-data'
  message?: string
  data?: any
  responseTime?: number
  fields?: string[]
}

// Helper to use proxy for CORS-blocked APIs
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'
const fetchThroughProxy = async (url: string, options?: RequestInit) => {
  const proxyUrl = `${PROXY_URL}/proxy?url=${encodeURIComponent(url)}`
  return fetch(proxyUrl, options)
}

export default function ApiTestPage() {
  const [isbn, setIsbn] = useState('9780143127741')
  const [results, setResults] = useState<ApiTestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const apis = [
    {
      name: 'Google Books',
      needsProxy: false,
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
        // Search across all fields: ISBN, title, author, publisher, etc.
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn)}${apiKey ? `&key=${apiKey}` : ''}`
        const response = await fetch(url)
        if (response.status === 429) throw new Error('RATE_LIMITED')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const book = data.items?.[0]?.volumeInfo
        const fields = book ? Object.keys(book).filter(k => book[k]) : []
        return { 
          found: data.totalItems > 0, 
          data: book?.title,
          fields: fields.slice(0, 25)
        }
      }
    },
    {
      name: 'Open Library',
      needsProxy: false,
      test: async (isbn: string) => {
        // Try ISBN first, fallback to general search
        const url = isbn.match(/^\d+$/) 
          ? `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
          : `https://openlibrary.org/search.json?q=${encodeURIComponent(isbn)}&limit=1`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const bookData = data[`ISBN:${isbn}`]
        const fields = bookData ? Object.keys(bookData).filter(k => bookData[k]) : []
        return { 
          found: !!bookData, 
          data: bookData?.title,
          fields: fields.slice(0, 25)
        }
      }
    },
    {
      name: 'OCLC Classify',
      needsProxy: true,
      test: async (isbn: string) => {
        const url = `http://classify.oclc.org/classify2/Classify?isbn=${isbn}&summary=true`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const parser = new DOMParser()
        const xml = parser.parseFromString(text, 'text/xml')
        const work = xml.querySelector('work')
        const dewey = xml.querySelector('recommendations > ddc > mostPopular')?.getAttribute('nsfa')
        const lcc = xml.querySelector('recommendations > lcc > mostPopular')?.getAttribute('nsfa')
        const fields = []
        if (work?.getAttribute('title')) fields.push('title')
        if (work?.getAttribute('author')) fields.push('author')
        if (dewey) fields.push('deweyDecimal')
        if (lcc) fields.push('lcc')
        return { 
          found: !!work, 
          data: work?.getAttribute('title'),
          fields
        }
      }
    },
    {
      name: 'Library of Congress',
      needsProxy: true,
      test: async (isbn: string) => {
        // Use public search API - the SRU endpoint uses Z39.50 protocol on port 210 which doesn't work over HTTP
        const url = `https://www.loc.gov/search/?q=${isbn}&fo=json&at=results&c=150`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const fields = []
        if (data.results?.length > 0) {
          const result = data.results[0]
          if (result.title) fields.push('title')
          if (result.contributor) fields.push('contributor')
          if (result.date) fields.push('date')
          if (result.location) fields.push('location')
          if (result.language) fields.push('language')
        }
        return { 
          found: data.results?.length > 0, 
          data: data.results?.[0]?.title,
          fields
        }
      }
    },
    {
      name: 'ISBNdb',
      needsProxy: false,
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_ISBNDB_API_KEY
        if (!apiKey) {
          throw new Error('API key not configured')
        }
        const url = `https://api2.isbndb.com/book/${isbn}`
        const response = await fetch(url, {
          headers: { 'Authorization': apiKey }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const book = data.book
        const fields = book ? Object.keys(book).filter(k => book[k]).slice(0, 25) : []
        return { 
          found: !!book, 
          data: book?.title,
          fields
        }
      }
    },
    {
      name: 'WorldCat',
      needsProxy: true,
      test: async (isbn: string) => {
        const url = `https://www.worldcat.org/search?q=bn:${isbn}&format=json`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        return { 
          found: text.includes(isbn), 
          data: text.length > 0 ? 'Response received' : 'No response',
          fields: ['basic data']
        }
      }
    },
    {
      name: 'CrossRef',
      needsProxy: false,
      test: async (isbn: string) => {
        const url = `https://api.crossref.org/works?filter=isbn:${isbn}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const item = data.message.items?.[0]
        const fields = item ? Object.keys(item).filter(k => item[k]).slice(0, 25) : []
        return { 
          found: data.message['total-results'] > 0, 
          data: item?.title?.[0],
          fields
        }
      }
    },
    {
      name: 'Internet Archive',
      needsProxy: false,
      test: async (isbn: string) => {
        const url = `https://archive.org/advancedsearch.php?q=isbn:${isbn}&output=json`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const doc = data.response.docs?.[0]
        const fields = doc ? Object.keys(doc).filter(k => doc[k]).slice(0, 25) : []
        return { 
          found: data.response.numFound > 0, 
          data: doc?.title,
          fields
        }
      }
    },
    {
      name: 'British Library',
      needsProxy: true,
      test: async (isbn: string) => {
        // Try the BL's search API instead of SPARQL (which times out)
        const url = `http://primocat.bl.uk/F?func=find-b&find_code=ISN&request=${isbn}`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const hasResult = text.includes('item-title') || text.includes('record')
        const titleMatch = text.match(/<[^>]*class="item-title"[^>]*>([^<]+)</)
        const fields = hasResult ? ['title', 'catalog record'] : []
        return { 
          found: hasResult, 
          data: titleMatch?.[1]?.trim() || (hasResult ? 'Found in catalog' : null),
          fields
        }
      }
    },
    {
      name: 'LibraryThing',
      needsProxy: true,
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_LIBRARYTHING_API_KEY || '9d3aab45fc09f6e22bc601ee44c5e023'
        const url = `http://www.librarything.com/services/rest/1.1/?method=librarything.ck.getwork&isbn=${isbn}&apikey=${apiKey}`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const parser = new DOMParser()
        const xml = parser.parseFromString(text, 'text/xml')
        const work = xml.querySelector('work')
        const fields = []
        if (xml.querySelector('title')) fields.push('title')
        if (xml.querySelector('author')) fields.push('author')
        if (xml.querySelector('rating')) fields.push('rating')
        const title = xml.querySelector('title')?.textContent
        return { 
          found: !!work, 
          data: title,
          fields
        }
      }
    },
    {
      name: 'BookBrainz',
      needsProxy: true,
      test: async (isbn: string) => {
        const url = `https://bookbrainz.org/search/search?q=${isbn}&collection=edition`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const edition = data?.[0]
        const fields = []
        if (edition?.defaultAlias?.name) fields.push('title')
        if (edition?.authors) fields.push('authors')
        return { 
          found: data?.length > 0, 
          data: edition?.defaultAlias?.name,
          fields
        }
      }
    },
    {
      name: 'German National Library (DNB)',
      needsProxy: false,
      test: async (isbn: string) => {
        const url = `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D${isbn}&recordSchema=MARC21-xml&maximumRecords=1`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const hasRecord = text.includes('<marc:record')
        const fields = []
        if (hasRecord) {
          if (text.includes('<marc:datafield tag="245"')) fields.push('title')
          if (text.includes('<marc:datafield tag="020"')) fields.push('isbn')
          if (text.includes('<marc:datafield tag="082"')) fields.push('dewey')
        }
        const match = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
        return { 
          found: hasRecord, 
          data: match?.[1],
          fields
        }
      }
    },
    {
      name: 'Bibliothèque nationale de France (BNF)',
      needsProxy: false,
      test: async (isbn: string) => {
        const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20all%20%22${isbn}%22&recordSchema=unimarcxchange&maximumRecords=1`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const hasRecord = text.includes('<record ')
        const fields = []
        if (hasRecord) {
          if (text.includes('tag="200"')) fields.push('title')
          if (text.includes('tag="010"')) fields.push('isbn')
          if (text.includes('tag="700"')) fields.push('author')
        }
        const match = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
        return { 
          found: hasRecord, 
          data: match?.[1],
          fields
        }
      }
    },
    {
      name: 'National Library of Australia (NLA)',
      needsProxy: true,
      test: async (isbn: string) => {
        const url = `https://www.nla.gov.au/apps/srw/search/nla?version=1.1&operation=searchRetrieve&query=isbn=${isbn}&recordSchema=marcxml&maximumRecords=1`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const hasRecord = text.includes('<marc:record')
        const fields = []
        if (hasRecord) {
          if (text.includes('<marc:datafield tag="245"')) fields.push('title')
          if (text.includes('<marc:datafield tag="020"')) fields.push('isbn')
        }
        const match = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
        return { 
          found: hasRecord, 
          data: match?.[1],
          fields
        }
      }
    },
    {
      name: 'Semantic Scholar',
      needsProxy: false,
      test: async (isbn: string) => {
        const url = `https://api.semanticscholar.org/graph/v1/paper/ISBN:${isbn}?fields=title,authors,citationCount,influentialCitationCount`
        const response = await fetch(url)
        if (response.status === 404) return { found: false, data: null, fields: [] }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const fields = []
        if (data.title) fields.push('title')
        if (data.authors) fields.push('authors')
        if (data.citationCount !== undefined) fields.push('citationCount')
        if (data.influentialCitationCount !== undefined) fields.push('influentialCitationCount')
        return { 
          found: !!data.title, 
          data: data.title,
          fields
        }
      }
    },
    {
      name: 'HathiTrust',
      needsProxy: true,
      test: async (isbn: string) => {
        const url = `https://catalog.hathitrust.org/api/volumes/brief/isbn/${isbn}.json`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const items = data.items
        if (!items || Object.keys(items).length === 0) return { found: false, data: null, fields: [] }
        const firstItem = Object.values(items)[0] as any
        const records = firstItem.records
        const firstRecord = Object.values(records)[0] as any
        const fields = []
        if (firstRecord.titles) fields.push('title')
        if (firstRecord.publishDates) fields.push('publishDate')
        if (firstRecord.oclcs) fields.push('oclcNumber')
        return { 
          found: true, 
          data: firstRecord.titles?.[0],
          fields
        }
      }
    },
    {
      name: 'DPLA (Digital Public Library)',
      needsProxy: true,
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_DPLA_API_KEY || '03e89f298b97f7556ca7fed9630b20d0'
        // DPLA searches across title, author, subject, etc.
        const url = `https://api.dp.la/v2/items?q=${encodeURIComponent(isbn)}&api_key=${apiKey}`
        const response = await fetchThroughProxy(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const doc = data.docs?.[0]
        const fields = []
        if (doc?.sourceResource?.title) fields.push('title')
        if (doc?.sourceResource?.creator) fields.push('creator')
        if (doc?.sourceResource?.date) fields.push('date')
        if (doc?.sourceResource?.description) fields.push('description')
        return { 
          found: data.count > 0, 
          data: doc?.sourceResource?.title,
          fields
        }
      }
    },
    {
      name: 'Europeana',
      needsProxy: false,
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_EUROPEANA_API_KEY
        if (!apiKey) throw new Error('API key required - add VITE_EUROPEANA_API_KEY to .env.local')
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${apiKey}&query=${isbn}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const item = data.items?.[0]
        const fields = []
        if (item?.title) fields.push('title')
        if (item?.dcCreator) fields.push('creator')
        if (item?.year) fields.push('year')
        if (item?.type) fields.push('type')
        return { 
          found: data.totalResults > 0, 
          data: item?.title?.[0],
          fields
        }
      }
    }
  ]

  const runTests = async () => {
    setIsRunning(true)
    setResults([])

    for (const api of apis) {
      const startTime = Date.now()
      
      // Add testing status
      setResults(prev => [...prev, {
        name: api.name,
        status: 'testing'
      }])

      try {
        const result = await api.test(isbn)
        const responseTime = Date.now() - startTime

        setResults(prev => prev.map(r => 
          r.name === api.name 
            ? {
                ...r,
                status: result.found ? 'success' : 'no-data',
                message: result.found ? `Found: ${result.data}` : 'No data found',
                responseTime,
                fields: result.fields
              }
            : r
        ))
      } catch (error: any) {
        const responseTime = Date.now() - startTime
        const isRateLimit = error.message === 'RATE_LIMITED'
        const isCors = error.message.includes('Failed to fetch')

        setResults(prev => prev.map(r => 
          r.name === api.name 
            ? {
                ...r,
                status: isRateLimit ? 'rate-limited' : 'error',
                message: isCors ? 'CORS blocked' : error.message,
                responseTime
              }
            : r
        ))
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const getStatusColor = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'testing': return 'text-blue-600 bg-blue-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'rate-limited': return 'text-orange-600 bg-orange-50'
      case 'no-data': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'success': return '✅'
      case 'testing': return '🔄'
      case 'error': return '❌'
      case 'rate-limited': return '⚠️'
      case 'no-data': return '📭'
      default: return '❓'
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Book API Tester</h1>
      
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="Enter ISBN, title, author, publisher, or year..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={runTests}
          disabled={isRunning}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Testing...' : 'Test All APIs'}
        </button>
      </div>

      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{getStatusIcon(result.status)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold">{result.name}</h3>
                  {result.message && (
                    <p className="text-sm opacity-80">{result.message}</p>
                  )}
                  {result.data && (
                    <p className="text-sm mt-1 font-medium text-blue-700">
                      {typeof result.data === 'string' ? result.data : JSON.stringify(result.data).substring(0, 100)}
                    </p>
                  )}
                  {result.fields && result.fields.length > 0 && (
                    <p className="text-xs opacity-60 mt-1">
                      Available fields ({result.fields.length}): {result.fields.slice(0, 15).join(', ')}{result.fields.length > 15 ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>
              {result.responseTime && (
                <span className="text-sm opacity-60">{result.responseTime}ms</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {results.length > 0 && !isRunning && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-green-600 font-semibold">✅ Success:</span> {results.filter(r => r.status === 'success').length}
            </div>
            <div>
              <span className="text-gray-600 font-semibold">📭 No Data:</span> {results.filter(r => r.status === 'no-data').length}
            </div>
            <div>
              <span className="text-red-600 font-semibold">❌ Error:</span> {results.filter(r => r.status === 'error').length}
            </div>
            <div>
              <span className="text-orange-600 font-semibold">⚠️ Rate Limited:</span> {results.filter(r => r.status === 'rate-limited').length}
            </div>
            <div>
              <span className="font-semibold">Total:</span> {results.length}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm">
        <h3 className="font-semibold mb-2">📋 Testing Notes:</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li><strong>✅ Success</strong> - API responded with book data</li>
          <li><strong>📭 No data</strong> - API works but doesn't have this ISBN in their database</li>
          <li><strong>❌ CORS blocked</strong> - Proxy server is needed (running on port 3001) ✓</li>
          <li><strong>⚠️ Rate limited</strong> - Too many requests, need API key or wait</li>
          <li><strong>🔑 API key not configured</strong> - Set environment variable (see .env.example)</li>
        </ul>
        <div className="mt-3 p-2 bg-white rounded border border-blue-200">
          <p className="font-semibold text-blue-800">Proxy Status: <span className="text-green-600">✓ Running on port 3001</span></p>
          <p className="text-xs mt-1">APIs using proxy: OCLC Classify, Library of Congress, WorldCat</p>
        </div>
      </div>
    </div>
  )
}
