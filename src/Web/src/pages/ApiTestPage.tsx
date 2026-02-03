import React, { useState } from 'react'

interface ApiTestResult {
  name: string
  status: 'testing' | 'success' | 'error' | 'rate-limited' | 'no-data'
  message?: string
  data?: any
  responseTime?: number
}

export default function ApiTestPage() {
  const [isbn, setIsbn] = useState('9780143127741')
  const [results, setResults] = useState<ApiTestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const apis = [
    {
      name: 'Google Books',
      test: async (isbn: string) => {
        const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
        const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${apiKey ? `&key=${apiKey}` : ''}`
        const response = await fetch(url)
        if (response.status === 429) throw new Error('RATE_LIMITED')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return { found: data.totalItems > 0, data: data.items?.[0]?.volumeInfo?.title }
      }
    },
    {
      name: 'Open Library',
      test: async (isbn: string) => {
        const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const bookData = data[`ISBN:${isbn}`]
        return { found: !!bookData, data: bookData?.title }
      }
    },
    {
      name: 'CrossRef',
      test: async (isbn: string) => {
        const url = `https://api.crossref.org/works?filter=isbn:${isbn}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return { found: data.message['total-results'] > 0, data: data.message.items?.[0]?.title }
      }
    },
    {
      name: 'Internet Archive',
      test: async (isbn: string) => {
        const url = `https://archive.org/advancedsearch.php?q=isbn:${isbn}&output=json`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return { found: data.response.numFound > 0, data: data.response.docs?.[0]?.title }
      }
    },
    {
      name: 'OCLC Classify',
      test: async (isbn: string) => {
        const url = `http://classify.oclc.org/classify2/Classify?isbn=${isbn}&summary=true`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        return { found: text.includes('<work '), data: 'XML response' }
      }
    },
    {
      name: 'WorldCat Search',
      test: async (isbn: string) => {
        const url = `https://www.worldcat.org/search?q=bn:${isbn}&format=json`
        const response = await fetch(url, { redirect: 'manual' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return { found: !!data, data: 'Response received' }
      }
    },
    {
      name: 'Library of Congress',
      test: async (isbn: string) => {
        const url = `https://www.loc.gov/books/?q=${isbn}&fo=json`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return { found: data.results?.length > 0, data: data.results?.[0]?.title }
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
                responseTime
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
          placeholder="Enter ISBN"
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
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(result.status)}</span>
                <div>
                  <h3 className="font-semibold">{result.name}</h3>
                  {result.message && (
                    <p className="text-sm opacity-80">{result.message}</p>
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
        <h3 className="font-semibold mb-2">Notes:</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li><strong>CORS blocked</strong> - API requires proxy server (check if proxy is running on port 3001)</li>
          <li><strong>Rate limited</strong> - Too many requests, need API key or wait</li>
          <li><strong>No data</strong> - API works but doesn't have this ISBN</li>
          <li><strong>Error</strong> - API unavailable or network issue</li>
        </ul>
      </div>
    </div>
  )
}
