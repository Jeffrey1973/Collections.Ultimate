// Extended API implementations
import { Book } from './books'

// CORS proxy configuration
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

// Helper function to make API calls through CORS proxy
async function fetchThroughProxy(url: string, options?: RequestInit): Promise<Response> {
  const proxyUrl = `${PROXY_URL}/proxy?url=${encodeURIComponent(url)}`
  console.log(`🔄 Proxying request: ${url.substring(0, 80)}... via ${PROXY_URL}`)
  return fetch(proxyUrl, options)
}

// Deutsche Nationalbibliothek (German National Library)
export async function lookupFromDNB(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Deutsche Nationalbibliothek:', isbn)
    const url = `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=isbn%3D${isbn}&recordSchema=oai_dc&maximumRecords=1`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const text = await response.text()
    
    // Basic XML parsing (simplified)
    const titleMatch = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
    const creatorMatch = text.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/)
    const publisherMatch = text.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/)
    const dateMatch = text.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/)
    const descriptionMatch = text.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/)
    const languageMatch = text.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/)
    
    if (!titleMatch) return null
    
    return {
      title: titleMatch[1],
      author: creatorMatch?.[1],
      publisher: publisherMatch?.[1],
      publishedDate: dateMatch?.[1],
      description: descriptionMatch?.[1],
      language: languageMatch?.[1],
      isbn: isbn,
    }
  } catch (error) {
    console.error('DNB lookup failed:', error)
    return null
  }
}

// Bibliothèque nationale de France
export async function lookupFromBNF(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Bibliothèque nationale de France:', isbn)
    const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20all%20%22${isbn}%22&recordSchema=dublincore&maximumRecords=1`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const text = await response.text()
    
    // Basic XML parsing
    const titleMatch = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
    const creatorMatch = text.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/)
    const publisherMatch = text.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/)
    const dateMatch = text.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/)
    const descriptionMatch = text.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/)
    
    if (!titleMatch) return null
    
    return {
      title: titleMatch[1],
      author: creatorMatch?.[1],
      publisher: publisherMatch?.[1],
      publishedDate: dateMatch?.[1],
      description: descriptionMatch?.[1],
      isbn: isbn,
    }
  } catch (error) {
    console.error('BNF lookup failed:', error)
    return null
  }
}

// National Library of Australia
export async function lookupFromNLA(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from National Library of Australia:', isbn)
    // Try NLA Catalogue API (publicly accessible)
    const url = `https://catalogue.nla.gov.au/Record/${isbn}/Export?style=xml`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const text = await response.text()
    
    // Basic XML/MARC parsing
    const titleMatch = text.match(/<marc:subfield code="a">([^<]+)<\/marc:subfield>/)
    const authorMatch = text.match(/<marc:datafield tag="100"[^>]*>[\s\S]*?<marc:subfield code="a">([^<]+)<\/marc:subfield>/)
    const publisherMatch = text.match(/<marc:datafield tag="260"[^>]*>[\s\S]*?<marc:subfield code="b">([^<]+)<\/marc:subfield>/)
    const dateMatch = text.match(/<marc:datafield tag="260"[^>]*>[\s\S]*?<marc:subfield code="c">([^<]+)<\/marc:subfield>/)
    
    if (!titleMatch) {
      console.log('No books found in NLA for ISBN:', isbn)
      return null
    }

    console.log('Book found in NLA:', titleMatch[1])

    return {
      title: titleMatch[1] || 'Unknown Title',
      author: authorMatch?.[1],
      publisher: publisherMatch?.[1],
      publishedDate: dateMatch?.[1],
      isbn: isbn,
    }
  } catch (error) {
    console.error('NLA lookup failed:', error)
    return null
  }
}

// HathiTrust Digital Library
export async function lookupFromHathiTrust(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from HathiTrust:', isbn)
    const url = `https://catalog.hathitrust.org/api/volumes/brief/isbn/${isbn}.json`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    const items = data.items
    
    if (!items || Object.keys(items).length === 0) return null

    const firstItem = Object.values(items)[0] as any
    const records = firstItem.records
    const firstRecord = Object.values(records)[0] as any
    
    return {
      title: firstRecord.titles?.[0],
      author: firstRecord.isbns?.join(', '),
      isbn: isbn,
      publishedDate: firstRecord.publishDates?.[0],
      oclcNumber: firstRecord.oclcs?.[0],
    }
  } catch (error) {
    console.error('HathiTrust lookup failed:', error)
    return null
  }
}

// Internet Archive
export async function lookupFromInternetArchive(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Internet Archive:', isbn)
    const url = `https://archive.org/advancedsearch.php?q=isbn:${isbn}&fl[]=identifier,title,creator,publisher,date,subject,description,language,mediatype&output=json`
    
    const response = await fetchThroughProxy(url)
    if (!response.ok) return null

    const data = await response.json()
    
    if (!data.response || !data.response.docs || data.response.docs.length === 0) return null

    const book = data.response.docs[0]
    
    return {
      title: book.title,
      author: Array.isArray(book.creator) ? book.creator.join(', ') : book.creator,
      isbn: isbn,
      publisher: Array.isArray(book.publisher) ? book.publisher[0] : book.publisher,
      publishedDate: book.date,
      subjects: Array.isArray(book.subject) ? book.subject : book.subject ? [book.subject] : undefined,
      description: book.description,
      language: book.language,
    }
  } catch (error) {
    console.error('Internet Archive lookup failed:', error)
    return null
  }
}

// Goodreads (web scraping required since API deprecated)
export async function lookupFromGoodreads(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Goodreads:', isbn)
    // Goodreads API is deprecated, would need scraping
    // Could use unofficial APIs or web scraping
    console.log('Goodreads requires web scraping (API deprecated)')
    return null
  } catch (error) {
    console.error('Goodreads lookup failed:', error)
    return null
  }
}

// Amazon Product API
export async function lookupFromAmazon(isbn: string): Promise<Partial<Book> | null> {
  try {
    const apiKey = import.meta.env.VITE_AMAZON_API_KEY
    const accessKey = import.meta.env.VITE_AMAZON_ACCESS_KEY
    const secretKey = import.meta.env.VITE_AMAZON_SECRET_KEY
    
    if (!apiKey || !accessKey || !secretKey) {
      console.log('Amazon API credentials not configured')
      return null
    }
    
    console.log('Looking up ISBN from Amazon:', isbn)
    // Would need Amazon Product Advertising API v5 implementation with signing
    console.log('Amazon requires Product Advertising API v5 setup with request signing')
    return null
  } catch (error) {
    console.error('Amazon lookup failed:', error)
    return null
  }
}

// ThriftBooks
export async function lookupFromThriftBooks(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from ThriftBooks:', isbn)
    const url = `https://www.thriftbooks.com/w/${isbn}`
    // Would need web scraping
    console.log('ThriftBooks requires web scraping')
    return null
  } catch (error) {
    console.error('ThriftBooks lookup failed:', error)
    return null
  }
}

// Better World Books
export async function lookupFromBetterWorldBooks(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Better World Books:', isbn)
    const url = `https://www.betterworldbooks.com/search/results?q=${isbn}`
    // Would need web scraping
    console.log('Better World Books requires web scraping')
    return null
  } catch (error) {
    console.error('Better World Books lookup failed:', error)
    return null
  }
}

// Wikidata
export async function lookupFromWikidata(isbn: string): Promise<Partial<Book> | null> {
  try {
    console.log('Looking up ISBN from Wikidata:', isbn)
    
    // SPARQL query for ISBN
    const sparqlQuery = `
      SELECT ?book ?bookLabel ?authorLabel ?publisherLabel ?publicationDate ?pages WHERE {
        ?book wdt:P212 "${isbn.replace(/-/g, '')}" .
        OPTIONAL { ?book wdt:P50 ?author }
        OPTIONAL { ?book wdt:P123 ?publisher }
        OPTIONAL { ?book wdt:P577 ?publicationDate }
        OPTIONAL { ?book wdt:P1104 ?pages }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 1
    `
    
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`
    
    const response = await fetchThroughProxy(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BookCollectionApp/1.0'
      }
    })
    
    if (!response.ok) return null

    const data = await response.json()
    
    if (!data.results?.bindings || data.results.bindings.length === 0) return null

    const result = data.results.bindings[0]
    
    return {
      title: result.bookLabel?.value,
      author: result.authorLabel?.value,
      publisher: result.publisherLabel?.value,
      publishedDate: result.publicationDate?.value,
      pageCount: result.pages?.value ? parseInt(result.pages.value) : undefined,
      isbn: isbn,
    }
  } catch (error) {
    console.error('Wikidata lookup failed:', error)
    return null
  }
}
