import { useState, useRef, useCallback, useEffect } from 'react'
import { useHousehold } from '../context/HouseholdContext'
import { createBook, mapBookToIngestRequest, getDedupIndex, normalizeTitle, getAllHouseholdLocations, createHouseholdLocation } from '../api/backend'
import type { DedupIndex } from '../api/backend'
import { lookupBookByISBN, searchBookMultiple } from '../api/books'
import type { Book } from '../api/books'

// ─── Types ──────────────────────────────────────────────────────────────────

type ImportSource = 'custom' | 'librarything'

interface ParsedRow {
  [key: string]: string
}

interface ImportRow {
  rowIndex: number
  raw: ParsedRow
  mapped: Record<string, any>
  status: 'pending' | 'enriching' | 'enriched' | 'saving' | 'saved' | 'error' | 'skipped' | 'duplicate'
  error?: string
  dupReason?: string
  enrichedBook?: Record<string, any>
  apiSources?: string[]
}

// ─── Column mapping definitions ─────────────────────────────────────────────

const CUSTOM_CSV_COLUMN_MAP: Record<string, { field: string; label: string }> = {
  // Google Sheets / hand-built CSV columns
  'isbn': { field: 'isbn13', label: 'ISBN' },
  'isbn13': { field: 'isbn13', label: 'ISBN-13' },
  'isbn10': { field: 'isbn10', label: 'ISBN-10' },
  'title': { field: 'title', label: 'Title' },
  'author': { field: 'author', label: 'Author' },
  'pages': { field: 'pageCount', label: 'Pages' },
  'page count': { field: 'pageCount', label: 'Pages' },
  'pagecount': { field: 'pageCount', label: 'Pages' },
  'tags': { field: 'categories', label: 'Tags' },
  'genre': { field: 'categories', label: 'Genre' },
  'category': { field: 'categories', label: 'Category' },
  'pln': { field: 'location', label: 'Physical Location' },
  'location': { field: 'location', label: 'Location' },
  'shelf': { field: 'location', label: 'Shelf Location' },
  'completed': { field: 'completedDate', label: 'Completed Date' },
  'completed date': { field: 'completedDate', label: 'Completed Date' },
  'date completed': { field: 'completedDate', label: 'Completed Date' },
  'read': { field: 'read', label: 'Read Status' },
  'read?': { field: 'read', label: 'Read Status' },
  'publisher': { field: 'publisher', label: 'Publisher' },
  'published': { field: 'publishedDate', label: 'Published Date' },
  'description': { field: 'description', label: 'Description' },
  'notes': { field: 'notes', label: 'Notes' },
  'series': { field: 'series', label: 'Series' },
  'volume': { field: 'volumeNumber', label: 'Volume Number' },
  'barcode': { field: 'barcode', label: 'Barcode' },
  'condition': { field: 'condition', label: 'Condition' },
  'library order': { field: 'libraryOrder', label: 'Library Order' },
  'libraryorder': { field: 'libraryOrder', label: 'Library Order' },
  'library #': { field: 'libraryOrder', label: 'Library Order' },
  'entry order': { field: 'libraryOrder', label: 'Library Order' },
  'order': { field: 'libraryOrder', label: 'Library Order' },
}

const LIBRARYTHING_COLUMN_MAP: Record<string, { field: string; label: string }> = {
  // All 54 LibraryThing export columns
  'book id': { field: 'ltBookId', label: 'LT Book ID' },
  'title': { field: 'title', label: 'Title' },
  'sort character': { field: '_skip', label: 'Sort Character (skip)' },
  'primary author': { field: 'author', label: 'Author' },
  'primary author role': { field: '_skip', label: 'Author Role (skip)' },
  'secondary author': { field: 'contributors', label: 'Secondary Author' },
  'secondary author role': { field: '_skip', label: 'Secondary Author Role (skip)' },
  'publication': { field: 'publisher', label: 'Publisher' },
  'date': { field: 'publishedDate', label: 'Published Date' },
  'review': { field: 'userReviewText', label: 'Review' },
  'rating': { field: 'userRating', label: 'My Rating' },
  'comment': { field: 'notes', label: 'Comment → Notes' },
  'private comment': { field: 'privateNotes', label: 'Private Comment' },
  'summary': { field: 'description', label: 'Summary' },
  'media': { field: 'format', label: 'Media/Format' },
  'physical description': { field: 'physicalDescription', label: 'Physical Description' },
  'weight': { field: 'weight', label: 'Weight' },
  'height': { field: 'dimensionsHeight', label: 'Height' },
  'thickness': { field: 'dimensionsThickness', label: 'Thickness' },
  'length': { field: 'dimensionsWidth', label: 'Length/Width' },
  'dimensions': { field: 'dimensions', label: 'Dimensions' },
  'page count': { field: 'pageCount', label: 'Page Count' },
  'lccn': { field: 'lccn', label: 'LCCN' },
  'acquired': { field: 'acquiredDate', label: 'Date Acquired' },
  'date started': { field: 'dateStarted', label: 'Date Started' },
  'date read': { field: 'completedDate', label: 'Date Read' },
  'barcode': { field: 'barcode', label: 'Barcode' },
  'bcid': { field: 'libraryThingId', label: 'LT Work ID (BCID)' },
  'tags': { field: 'categories', label: 'Tags' },
  'collections': { field: 'collections', label: 'Collections' },
  'languages': { field: 'language', label: 'Language' },
  'original languages': { field: 'originalLanguage', label: 'Original Language' },
  'lc classification': { field: 'lcc', label: 'LC Classification' },
  'isbn': { field: 'isbn13', label: 'ISBN' },
  'isbns': { field: 'isbn13', label: 'ISBNs' },
  'subjects': { field: 'subjects', label: 'Subjects' },
  'dewey decimal': { field: 'deweyDecimal', label: 'Dewey Decimal' },
  'dewey wording': { field: 'deweyWording', label: 'Dewey Wording' },
  'other call number': { field: 'callNumber', label: 'Call Number' },
  'copies': { field: 'copies', label: 'Copies' },
  'source': { field: 'acquisitionSource', label: 'Source' },
  'entry date': { field: 'dateAdded', label: 'Entry Date' },
  'from where': { field: 'fromWhere', label: 'From Where' },
  'oclc': { field: 'oclcNumber', label: 'OCLC' },
  'work id': { field: 'ltWorkId', label: 'LT Work ID' },
  'lending patron': { field: 'lendingPatron', label: 'Lending Patron' },
  'lending status': { field: 'lendingStatus', label: 'Lending Status' },
  'lending start': { field: 'lendingStart', label: 'Lending Start' },
  'lending end': { field: 'lendingEnd', label: 'Lending End' },
  'list price': { field: 'listPriceAmount', label: 'List Price' },
  'purchase price': { field: 'purchasePrice', label: 'Purchase Price' },
  'value': { field: 'bookValue', label: 'Value' },
  'condition': { field: 'condition', label: 'Condition' },
  'issn': { field: 'issn', label: 'ISSN' },
  // Legacy aliases
  'author (first last)': { field: 'author', label: 'Author' },
  'author (last, first)': { field: 'author', label: 'Author' },
  'author': { field: 'author', label: 'Author' },
  'additional authors': { field: 'contributors', label: 'Additional Authors' },
  'secondary isbn': { field: 'isbn10', label: 'Secondary ISBN' },
  'my rating': { field: 'userRating', label: 'My Rating' },
  'comments': { field: 'notes', label: 'Comments' },
  'format': { field: 'format', label: 'Format' },
  'language': { field: 'language', label: 'Language' },
  'original language': { field: 'originalLanguage', label: 'Original Language' },
  'signed': { field: 'signed', label: 'Signed' },
  'read count': { field: 'readCount', label: 'Read Count' },
  'read dates': { field: 'completedDate', label: 'Read Dates' },
  'loaned to': { field: 'loanedTo', label: 'Loaned To' },
  'ddc': { field: 'deweyDecimal', label: 'Dewey Decimal' },
  'lcc': { field: 'lcc', label: 'LC Classification' },
}

// ─── CSV / TSV Parser ───────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  return tabCount > commaCount ? '\t' : ','
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.replace(/^\uFEFF/, '')) // strip BOM

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter)
    // Skip rows where all values are empty
    if (values.every(v => !v.trim())) continue
    const row: ParsedRow = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    // Skip rows with no title (check common title column names)
    const titleKey = headers.find(h => h.toLowerCase().trim() === 'title')
    if (titleKey && !row[titleKey]?.trim()) continue
    rows.push(row)
  }

  return { headers, rows }
}

// ─── Column Mapping Logic ───────────────────────────────────────────────────

function autoMapColumns(headers: string[], source: ImportSource): Record<string, string> {
  const mapping: Record<string, string> = {}
  const columnMap = source === 'librarything' ? LIBRARYTHING_COLUMN_MAP : CUSTOM_CSV_COLUMN_MAP

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    if (columnMap[normalized]) {
      mapping[header] = columnMap[normalized].field
    }
  }
  return mapping
}

// Available target fields for manual mapping
const COMMON_TARGET_FIELDS = [
  { value: '', label: '— Skip —' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'isbn13', label: 'ISBN-13' },
  { value: 'isbn10', label: 'ISBN-10' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'publishedDate', label: 'Published Date' },
  { value: 'pageCount', label: 'Page Count' },
  { value: 'description', label: 'Description' },
  { value: 'language', label: 'Language' },
  { value: 'originalLanguage', label: 'Original Language' },
  { value: 'categories', label: 'Tags / Categories' },
  { value: 'subjects', label: 'Subjects' },
  { value: 'series', label: 'Series' },
  { value: 'volumeNumber', label: 'Volume Number' },
  { value: 'format', label: 'Format / Binding' },
  { value: 'location', label: 'Physical Location' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'notes', label: 'Notes' },
  { value: 'read', label: 'Read Status' },
  { value: 'completedDate', label: 'Date Completed / Read' },
  { value: 'dateStarted', label: 'Date Started' },
  { value: 'readCount', label: 'Read Count' },
  { value: 'userRating', label: 'My Rating' },
  { value: 'averageRating', label: 'Average Rating' },
  { value: 'userReviewText', label: 'Review' },
  { value: 'condition', label: 'Condition' },
  { value: 'libraryOrder', label: 'Library Order' },
  { value: 'dateAdded', label: 'Date Added / Entry Date' },
  { value: 'deweyDecimal', label: 'Dewey Decimal' },
  { value: 'deweyWording', label: 'Dewey Wording' },
  { value: 'lcc', label: 'LC Classification' },
  { value: 'lccn', label: 'LCCN' },
  { value: 'callNumber', label: 'Call Number' },
  { value: 'contributors', label: 'Additional Authors' },
]

const LIBRARYTHING_EXTRA_FIELDS = [
  { value: 'ltBookId', label: 'LT Book ID (for cover)' },
  { value: 'ltWorkId', label: 'LT Work ID' },
  { value: 'libraryThingId', label: 'LibraryThing ID (BCID)' },
  { value: 'privateNotes', label: 'Private Comment' },
  { value: 'collections', label: 'Collections' },
  { value: 'physicalDescription', label: 'Physical Description' },
  { value: 'weight', label: 'Weight' },
  { value: 'dimensionsHeight', label: 'Height' },
  { value: 'dimensionsWidth', label: 'Width / Length' },
  { value: 'dimensionsThickness', label: 'Thickness' },
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'acquiredDate', label: 'Date Acquired' },
  { value: 'acquisitionSource', label: 'Source (where acquired)' },
  { value: 'fromWhere', label: 'From Where' },
  { value: 'purchasePrice', label: 'Purchase Price' },
  { value: 'listPriceAmount', label: 'List Price' },
  { value: 'bookValue', label: 'Value' },
  { value: 'copies', label: 'Copies' },
  { value: 'oclcNumber', label: 'OCLC Number' },
  { value: 'issn', label: 'ISSN' },
  { value: 'lendingPatron', label: 'Lending Patron' },
  { value: 'lendingStatus', label: 'Lending Status' },
  { value: 'lendingStart', label: 'Lending Start' },
  { value: 'lendingEnd', label: 'Lending End' },
  { value: 'signed', label: 'Signed' },
  { value: 'loanedTo', label: 'Loaned To' },
]

const CUSTOM_EXTRA_FIELDS = [
  { value: 'binding', label: 'Binding' },
]

function getTargetFields(source: ImportSource) {
  const extras = source === 'librarything' ? LIBRARYTHING_EXTRA_FIELDS : CUSTOM_EXTRA_FIELDS
  return [...COMMON_TARGET_FIELDS, ...extras]
}

// ─── Row Mapping ────────────────────────────────────────────────────────────

function mapRow(raw: ParsedRow, columnMapping: Record<string, string>, source: ImportSource): ImportRow['mapped'] {
  const mapped: any = {}

  for (const [csvCol, targetField] of Object.entries(columnMapping)) {
    if (!targetField || targetField === '_skip' || !raw[csvCol]) continue
    const val = raw[csvCol].trim()
    if (!val) continue

    switch (targetField) {
      case 'pageCount':
      case 'copies':
      case 'libraryOrder':
        mapped[targetField] = parseInt(val, 10) || undefined
        break
      case 'tags':
        mapped.tags = val.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)
        break
      case 'categories':
        mapped.categories = val.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)
        break
      case 'subjects':
        mapped.subjects = val.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean)
        break
      case 'collections':
        mapped.collections = val.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)
        break
      case 'read': {
        const lower = val.toLowerCase()
        mapped.read = ['yes', 'true', '1', 'x', 'read', 'y'].includes(lower) ? 'yes' : 'no'
        break
      }
      case 'userRating':
      case 'averageRating': {
        const rating = parseFloat(val)
        mapped[targetField] = (!isNaN(rating) && rating >= 0) ? Math.round(Math.min(rating, 999) * 100) / 100 : undefined
      }
        break
      case 'isbn13':
      case 'isbn10': {
        // Clean ISBN - might have multiple, pick best one
        // LibraryThing wraps ISBNs in brackets: [0123456789] or [0123456789, 9780123456789]
        let isbns: string[] = []
        if (val.includes('[')) {
          const matches = val.match(/\d{10,13}/g)
          if (matches) isbns = matches
        } else {
          isbns = [val.replace(/[^0-9Xx]/g, '')]
        }
        for (const isbn of isbns) {
          if (isbn.length === 13 && !mapped.isbn13) mapped.isbn13 = isbn
          else if (isbn.length === 10 && !mapped.isbn10) mapped.isbn10 = isbn
        }
        break
      }
      case 'contributors': {
        // Semicolon or comma separated additional authors; LT uses "Last, First" format
        const names = val.split(/;/).map((name: string) => name.trim()).filter(Boolean)
        mapped.contributors = names.map((name: string) => {
          // Flip "Last, First" if it looks like that pattern
          if (source === 'librarything' && name.includes(',') && !name.match(/\d/)) {
            const parts = name.split(',').map((p: string) => p.trim())
            if (parts.length === 2) name = `${parts[1]} ${parts[0]}`
          }
          return { name, role: 'author' }
        })
        break
      }
      default:
        mapped[targetField] = val
    }
  }

  // For LibraryThing: flip "Last, First" author to "First Last"
  if (source === 'librarything' && mapped.author && mapped.author.includes(',')) {
    const parts = mapped.author.split(',').map((p: string) => p.trim())
    if (parts.length === 2 && !mapped.author.match(/\d/)) {
      mapped.author = `${parts[1]} ${parts[0]}`
    }
  }

  return mapped
}

// ─── Enrichment helpers ─────────────────────────────────────────────────────

function mergeApiData(csvData: Record<string, any>, apiData: Partial<Book>): Record<string, any> {
  const merged: Record<string, any> = { ...apiData }

  // CSV data takes priority for fields the user explicitly provided
  for (const [key, value] of Object.entries(csvData)) {
    if (value !== undefined && value !== null && value !== '' &&
        !(Array.isArray(value) && value.length === 0)) {
      (merged as any)[key] = value
    }
  }

  // Special merge for categories — combine both sources
  if (csvData.categories && apiData.categories) {
    const allCats = [...new Set([...csvData.categories, ...apiData.categories])]
    merged.categories = allCats
  }

  return merged
}

function buildLTCoverUrl(ltBookId?: string): string | undefined {
  if (!ltBookId) return undefined
  return `https://pics.cdn.librarything.com/picsizes/${ltBookId}/original.jpg`
}

// ─── Component ──────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

export default function ImportBooksPage() {
  const { selectedHousehold } = useHousehold()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [source, setSource] = useState<ImportSource>('custom')
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [_isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: '' })
  const importStartTimeRef = useRef<number>(0)
  const activeRowRef = useRef<HTMLTableRowElement | null>(null)
  const [importResults, setImportResults] = useState({ saved: 0, errors: 0, skipped: 0, duplicates: 0 })
  const [allowDuplicates, setAllowDuplicates] = useState(false)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'duplicates-only' | 'new-only'>('all')
  const [dupScanDone, setDupScanDone] = useState(false)
  const [dupScanLoading, setDupScanLoading] = useState(false)
  const [dupRowIndices, setDupRowIndices] = useState<Set<number>>(new Set())
  const abortRef = useRef(false)

  // Auto-scroll the active row into view during import
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [importProgress.current])

  // ─── File handling ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const { headers: parsedHeaders, rows } = parseCSV(text)

      setHeaders(parsedHeaders)
      setRawRows(rows)

      // Auto-map columns
      const mapping = autoMapColumns(parsedHeaders, source)
      setColumnMapping(mapping)
      setStep('mapping')
    }
    reader.readAsText(file)
  }, [source])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    // Trigger same logic as file select
    const dt = new DataTransfer()
    dt.items.add(file)
    if (fileInputRef.current) {
      fileInputRef.current.files = dt.files
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, [])

  // ─── Mapping confirmed → build preview ─────────────────────────────────

  const confirmMapping = useCallback(() => {
    const rows: ImportRow[] = rawRows.map((raw, idx) => ({
      rowIndex: idx,
      raw,
      mapped: mapRow(raw, columnMapping, source),
      status: 'pending' as const,
    }))
    setImportRows(rows)
    setStep('preview')
  }, [rawRows, columnMapping, source])

  // ─── Pre-scan for duplicates within the CSV (does NOT import) ───────────

  const preScanDuplicates = useCallback(async () => {
    setDupScanLoading(true)
    try {
      // Build a map keyed by ISBN or normalized title → first row index seen
      const seenByIsbn = new Map<string, number>()   // normIsbn → first row index
      const seenByTitle = new Map<string, number>()   // normTitle → first row index

      const dupes = new Set<number>()

      for (let i = 0; i < importRows.length; i++) {
        const { mapped } = importRows[i]
        const isbn = mapped.isbn13 || mapped.isbn10
        let isDup = false
        let matchedFirst: number | undefined

        // Check ISBN match within CSV
        if (isbn) {
          const normIsbn = isbn.toString().replace(/[^0-9Xx]/g, '').toUpperCase()
          if (normIsbn) {
            const firstIdx = seenByIsbn.get(normIsbn)
            if (firstIdx !== undefined) {
              isDup = true
              matchedFirst = firstIdx
            } else {
              seenByIsbn.set(normIsbn, i)
            }
          }
        }

        // Check title match within CSV
        if (!isDup && mapped.title) {
          const normTitle = normalizeTitle(mapped.title)
          if (normTitle) {
            const firstIdx = seenByTitle.get(normTitle)
            if (firstIdx !== undefined) {
              isDup = true
              matchedFirst = firstIdx
            } else {
              seenByTitle.set(normTitle, i)
            }
          }
        }

        // Mark the FIRST occurrence as the duplicate (it's already in the library).
        // Subsequent copies are the ones we want to import.
        if (isDup && matchedFirst !== undefined) {
          dupes.add(matchedFirst)
        }
      }

      setDupRowIndices(dupes)
      setDupScanDone(true)
    } catch (err) {
      console.error('Pre-scan failed:', err)
    } finally {
      setDupScanLoading(false)
    }
  }, [importRows])

  // Filtered rows for display and import
  const filteredImportRows = importRows.map((row, idx) => ({ row, originalIndex: idx })).filter(({ originalIndex }) => {
    if (!dupScanDone || previewFilter === 'all') return true
    const isDup = dupRowIndices.has(originalIndex)
    return previewFilter === 'duplicates-only' ? isDup : !isDup
  })

  // ─── Import logic ──────────────────────────────────────────────────────

  const startImport = useCallback(async () => {
    if (!selectedHousehold) return

    // When a filter is active, narrow importRows to only the filtered set
    const rowsToImport = dupScanDone && previewFilter !== 'all'
      ? importRows.filter((_, idx) => {
          const isDup = dupRowIndices.has(idx)
          return previewFilter === 'duplicates-only' ? isDup : !isDup
        })
      : importRows
    // If importing duplicates-only, force allowDuplicates behavior
    const effectiveAllowDuplicates = allowDuplicates || previewFilter === 'duplicates-only'

    setImportRows(rowsToImport)
    setIsImporting(true)
    setStep('importing')
    abortRef.current = false

    const total = rowsToImport.length
    let saved = 0
    let errors = 0
    let skipped = 0
    let duplicates = 0

    // Fetch dedup index from backend (existing barcodes, titles, identifiers)
    let dedupIndex: DedupIndex = { barcodes: [], normalizedTitles: [], identifiers: [] }
    let locationMap: Map<string, string> = new Map() // lowercased name → id
    try {
      setImportProgress({ current: 0, total, phase: 'Loading existing library for dedup check\u2026' })
      importStartTimeRef.current = Date.now()
      const [idx, locs] = await Promise.all([
        getDedupIndex(selectedHousehold.id),
        getAllHouseholdLocations(selectedHousehold.id)
      ])
      dedupIndex = idx
      for (const loc of locs) locationMap.set(loc.name.toLowerCase(), loc.id)
    } catch (err) {
      console.warn('Could not fetch dedup index, proceeding without dedup:', err)
    }

    // Build fast lookup sets
    const existingBarcodes = new Set(dedupIndex.barcodes.map(b => b.toUpperCase()))
    const existingTitles = new Set(dedupIndex.normalizedTitles.map(t => t.toUpperCase()))
    const existingIdents = new Set(dedupIndex.identifiers.map(i => i.toUpperCase()))

    for (let i = 0; i < rowsToImport.length; i++) {
      if (abortRef.current) break

      const row = rowsToImport[i]
      const { mapped } = row

      // Skip rows that were already saved successfully (safe re-run)
      if (row.status === 'saved') {
        saved++
        setImportProgress({ current: i + 1, total, phase: `Already saved: "${mapped.title}"` })
        continue
      }

      // Skip rows with no title
      if (!mapped.title) {
        setImportRows(prev => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'skipped', error: 'No title' }
          return next
        })
        skipped++
        setImportProgress({ current: i + 1, total, phase: `Skipped row ${i + 1} (no title)` })
        continue
      }

      // ── Dedup check ─────────────────────────────────────────────────
      if (!effectiveAllowDuplicates) {
        const isbn = mapped.isbn13 || mapped.isbn10
        let dupReason: string | undefined

        // 1. Check by ISBN as barcode
        if (!dupReason && isbn) {
          const normIsbn = isbn.toString().replace(/[^0-9Xx]/g, '').toUpperCase()
          if (existingBarcodes.has(normIsbn)) {
            dupReason = `ISBN ${isbn} already in library (barcode match)`
          }
        }

        // 2. Check by ISBN as edition identifier
        if (!dupReason && isbn) {
          const normIsbn = isbn.toString().replace(/[^0-9Xx]/g, '').toUpperCase()
          const isbn13Key = `2:${normIsbn}` // IdentifierTypeId 2 = ISBN-13
          const isbn10Key = `1:${normIsbn}` // IdentifierTypeId 1 = ISBN-10
          if (existingIdents.has(isbn13Key.toUpperCase()) || existingIdents.has(isbn10Key.toUpperCase())) {
            dupReason = `ISBN ${isbn} already in library (identifier match)`
          }
        }

        // 3. Check by normalized title
        if (!dupReason && mapped.title) {
          const normTitle = normalizeTitle(mapped.title)
          if (existingTitles.has(normTitle)) {
            dupReason = `Title "${mapped.title}" already in library`
          }
        }

        if (dupReason) {
          setImportRows(prev => {
            const next = [...prev]
            next[i] = { ...next[i], status: 'duplicate', dupReason }
            return next
          })
          duplicates++
          setImportProgress({ current: i + 1, total, phase: `Duplicate: "${mapped.title}"` })
          continue
        }
      }

      // Phase 1: Enrich from APIs
      setImportRows(prev => {
        const next = [...prev]
        next[i] = { ...next[i], status: 'enriching' }
        return next
      })
      setImportProgress({ current: i + 1, total, phase: `Enriching: "${mapped.title}"` })

      let enrichedBook: Partial<Book> = { ...mapped }
      const apiSources: string[] = ['CSV']

      try {
        const isbn = mapped.isbn13 || mapped.isbn10
        let apiData: Partial<Book> | null = null

        if (isbn) {
          // ISBN lookup — most reliable
          setImportProgress({ current: i + 1, total, phase: `Looking up ISBN ${isbn} for "${mapped.title}"` })
          apiData = await lookupBookByISBN(isbn)
          if (apiData) apiSources.push('ISBN Lookup')
        }

        if (!apiData && mapped.title && source === 'librarything') {
          // Fallback: search by title + author (LibraryThing only — custom CSV skips
          // this to avoid matching wrong editions; users can enrich individually later)
          const query = mapped.author ? `${mapped.title} ${mapped.author}` : mapped.title
          setImportProgress({ current: i + 1, total, phase: `Searching APIs for "${mapped.title}"` })
          const results = await searchBookMultiple(query)
          if (results.length > 0) {
            apiData = results[0]
            apiSources.push('Title Search')
          }
        }

        if (apiData) {
          enrichedBook = mergeApiData(mapped, apiData)
        }

        // LibraryThing cover fallback
        if (source === 'librarything') {
          const ltBookId = (mapped as any).ltBookId
          const ltCover = buildLTCoverUrl(ltBookId)
          if (ltCover && !enrichedBook.coverImageUrl) {
            enrichedBook.coverImageUrl = ltCover
          }
          // Also add LT cover as a fallback even if we have another cover
          if (ltCover) {
            if (!enrichedBook.coverImageFallbacks) enrichedBook.coverImageFallbacks = []
            if (!enrichedBook.coverImageFallbacks.includes(ltCover)) {
              enrichedBook.coverImageFallbacks.push(ltCover)
            }
          }
        }

        // Add cover fallbacks from Google Books / Open Library if we have an ISBN
        const coverIsbn = enrichedBook.isbn13 || enrichedBook.isbn10 || isbn
        if (coverIsbn && !enrichedBook.coverImageUrl) {
          enrichedBook.coverImageUrl = `https://books.google.com/books/content?vid=isbn:${coverIsbn}&printsec=frontcover&img=1&zoom=1`
          enrichedBook.coverImageFallbacks = [
            ...(enrichedBook.coverImageFallbacks || []),
            `https://covers.openlibrary.org/b/isbn/${coverIsbn}-M.jpg?default=false`,
          ]
        }

        // Preserve custom fields in metadata
        const metadata: Record<string, any> = {}
        if (mapped.read) {
          const raw = String(mapped.read).trim().toLowerCase()
          if (['yes', 'true', '1', 'read', 'finished', 'y'].includes(raw)) {
            metadata.readStatus = 'Read'
          } else if (['no', 'false', '0', 'unread', 'not read', 'n'].includes(raw)) {
            metadata.readStatus = 'Unread'
          } else if (['reading', 'currently reading', 'in progress', 'started'].includes(raw)) {
            metadata.readStatus = 'Currently Reading'
          } else if (['dnf', 'did not finish', 'abandoned'].includes(raw)) {
            metadata.readStatus = 'Did Not Finish'
          } else {
            metadata.readStatus = mapped.read // keep original if unrecognized
          }
        }
        if (mapped.completedDate) metadata.completedDate = mapped.completedDate
        if (mapped.dateStarted) metadata.dateStarted = mapped.dateStarted
        if ((mapped as any).readCount) metadata.readCount = (mapped as any).readCount
        if ((mapped as any).userRating) metadata.userRating = (mapped as any).userRating
        if ((mapped as any).userReviewText) metadata.userReviewText = (mapped as any).userReviewText
        if ((mapped as any).privateNotes) metadata.privateNotes = (mapped as any).privateNotes
        if ((mapped as any).copies) metadata.copies = (mapped as any).copies
        if ((mapped as any).collections) metadata.collections = (mapped as any).collections
        // Ownership & Acquisition
        if ((mapped as any).acquiredDate) metadata.acquiredDate = (mapped as any).acquiredDate
        if ((mapped as any).acquisitionSource) metadata.acquisitionSource = (mapped as any).acquisitionSource
        if ((mapped as any).fromWhere) metadata.fromWhere = (mapped as any).fromWhere
        if ((mapped as any).purchasePrice) metadata.purchasePrice = (mapped as any).purchasePrice
        if ((mapped as any).bookValue) metadata.bookValue = (mapped as any).bookValue
        if ((mapped as any).condition) metadata.condition = (mapped as any).condition
        // Lending
        if ((mapped as any).lendingPatron) metadata.lendingPatron = (mapped as any).lendingPatron
        if ((mapped as any).lendingStatus) metadata.lendingStatus = (mapped as any).lendingStatus
        if ((mapped as any).lendingStart) metadata.lendingStart = (mapped as any).lendingStart
        if ((mapped as any).lendingEnd) metadata.lendingEnd = (mapped as any).lendingEnd
        // LT IDs
        if ((mapped as any).ltBookId) metadata.ltBookId = (mapped as any).ltBookId
        if ((mapped as any).ltWorkId) metadata.ltWorkId = (mapped as any).ltWorkId
        // Classification extras
        if ((mapped as any).deweyWording) metadata.deweyWording = (mapped as any).deweyWording
        // Legacy fields
        if ((mapped as any).signed) metadata.signed = (mapped as any).signed
        if ((mapped as any).loanedTo) metadata.loanedTo = (mapped as any).loanedTo

        // Set location from physicalLocation or location field, resolve to LocationId
        const locationStr = mapped.physicalLocation || (mapped as any).location || (mapped as any).pln
        let resolvedLocationId = locationStr ? locationMap.get(locationStr.toLowerCase()) : undefined

        // Auto-create the location if it doesn't exist yet
        if (locationStr && !resolvedLocationId) {
          try {
            const created = await createHouseholdLocation(selectedHousehold.id, locationStr.trim())
            resolvedLocationId = created.id
            locationMap.set(locationStr.toLowerCase(), created.id)
          } catch (locErr) {
            console.warn(`Could not create location "${locationStr}":`, locErr)
          }
        }

        // Build the final book data for ingest
        const bookForSave: any = {
          ...enrichedBook,
          householdId: selectedHousehold.id,
          id: crypto.randomUUID(),
          dateAdded: (mapped as any).dateAdded || new Date().toISOString(),
        }

        if (resolvedLocationId) bookForSave.locationId = resolvedLocationId
        if ((mapped as any).libraryOrder) bookForSave.libraryOrder = (mapped as any).libraryOrder
        if (Object.keys(metadata).length > 0) {
          bookForSave.metadata = metadata
        }

        // Phase 2: Save to backend
        setImportRows(prev => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'saving', enrichedBook, apiSources }
          return next
        })
        setImportProgress({ current: i + 1, total, phase: `Saving: "${mapped.title}"` })

        const ingestRequest = mapBookToIngestRequest(bookForSave)

        // Add location to item
        if (resolvedLocationId) ingestRequest.item.locationId = resolvedLocationId
        // Add extra metadata to item
        if (Object.keys(metadata).length > 0) {
          const existing = ingestRequest.item.metadataJson ? JSON.parse(ingestRequest.item.metadataJson) : {}
          ingestRequest.item.metadataJson = JSON.stringify({ ...existing, ...metadata })
        }

        await createBook(ingestRequest, selectedHousehold.id, 'import')

        // Add to local dedup sets so later rows in this batch are caught
        if (isbn) existingBarcodes.add(isbn.toString().replace(/[^0-9Xx]/g, '').toUpperCase())
        if (mapped.title) existingTitles.add(normalizeTitle(mapped.title))

        setImportRows(prev => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'saved', enrichedBook, apiSources }
          return next
        })
        saved++
      } catch (err: any) {
        console.error(`Failed to import row ${i}:`, err)
        setImportRows(prev => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'error', error: err.message || 'Unknown error', enrichedBook, apiSources }
          return next
        })
        errors++
      }

      // Small delay to avoid rate-limiting APIs
      if (i < rowsToImport.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    setImportResults({ saved, errors, skipped, duplicates })
    setIsImporting(false)
    setStep('done')
  }, [importRows, selectedHousehold, source, allowDuplicates, dupScanDone, previewFilter, dupRowIndices])

  const cancelImport = () => { abortRef.current = true }

  const retryDuplicates = useCallback(() => {
    // Re-queue only the rows that were flagged as duplicates, reset them to pending
    const dupRows = importRows
      .filter(r => r.status === 'duplicate')
      .map(r => ({ ...r, status: 'pending' as const, dupReason: undefined }))
    if (dupRows.length === 0) return
    setImportRows(dupRows)
    setAllowDuplicates(true)
    setImportResults({ saved: 0, errors: 0, skipped: 0, duplicates: 0 })
    setStep('preview')
  }, [importRows])

  const exportDuplicatesCsv = useCallback(() => {
    const dupRows = importRows.filter(r => r.status === 'duplicate')
    if (dupRows.length === 0) return

    // Use the original raw CSV columns so the file can be re-imported directly
    const allHeaders = Object.keys(dupRows[0].raw)
    const csvLines = [
      allHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...dupRows.map(row =>
        allHeaders.map(h => {
          const val = row.raw[h] || ''
          return `"${val.replace(/"/g, '""')}"`
        }).join(',')
      ),
    ]

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `duplicates-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [importRows])

  const resetImport = () => {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setRawRows([])
    setColumnMapping({})
    setImportRows([])
    setImportResults({ saved: 0, errors: 0, skipped: 0, duplicates: 0 })
    setAllowDuplicates(false)
    setPreviewFilter('all')
    setDupScanDone(false)
    setDupScanLoading(false)
    setDupRowIndices(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Render helpers ─────────────────────────────────────────────────────

  const statusBadge = (status: ImportRow['status']) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: '#f1f5f9', color: '#64748b', label: 'Pending' },
      enriching: { bg: '#dbeafe', color: '#2563eb', label: 'Enriching...' },
      enriched: { bg: '#e0e7ff', color: '#4f46e5', label: 'Enriched' },
      saving: { bg: '#fef3c7', color: '#d97706', label: 'Saving...' },
      saved: { bg: '#dcfce7', color: '#16a34a', label: 'Saved' },
      error: { bg: '#fee2e2', color: '#dc2626', label: 'Error' },
      skipped: { bg: '#f3f4f6', color: '#9ca3af', label: 'Skipped' },
    }
    const s = styles[status] || styles.pending
    return (
      <span style={{
        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
        backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    )
  }

  // ─── Detect source automatically from headers ──────────────────────────

  const detectSource = useCallback((parsedHeaders: string[]): ImportSource => {
    const headerSet = new Set(parsedHeaders.map(h => h.toLowerCase().trim()))
    // LibraryThing-specific columns
    if (headerSet.has('bcid') || headerSet.has('book id') || headerSet.has('entry date') ||
        headerSet.has('author (last, first)') || headerSet.has('primary author')) {
      return 'librarything'
    }
    return source // keep user selection
  }, [source])

  // handleFileSelect is replaced by handleFileSelectWrapped which auto-detects source
  const _handleFileSelect = handleFileSelect
  void _handleFileSelect

  const handleFileSelectWrapped = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const { headers: parsedHeaders, rows } = parseCSV(text)

      setHeaders(parsedHeaders)
      setRawRows(rows)

      // Auto-detect source
      const detected = detectSource(parsedHeaders)
      setSource(detected)

      // Auto-map columns
      const mapping = autoMapColumns(parsedHeaders, detected)
      setColumnMapping(mapping)
      setStep('mapping')
    }
    reader.readAsText(file)
  }, [detectSource])

  // ─── UI ──────────────────────────────────────────────────────────────────

  if (!selectedHousehold) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <h2>Import Books</h2>
        <p>Please select a household first.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Import Books
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Import into <strong>{selectedHousehold.name}</strong> household
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['upload', 'mapping', 'preview', 'importing', 'done'] as Step[]).map((s, idx) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600,
              backgroundColor: step === s ? '#3b82f6' : (['upload', 'mapping', 'preview', 'importing', 'done'].indexOf(step) > idx ? '#10b981' : '#e2e8f0'),
              color: step === s || ['upload', 'mapping', 'preview', 'importing', 'done'].indexOf(step) > idx ? '#fff' : '#94a3b8',
            }}>
              {['upload', 'mapping', 'preview', 'importing', 'done'].indexOf(step) > idx ? '✓' : idx + 1}
            </div>
            <span style={{
              fontSize: '0.85rem', fontWeight: step === s ? 600 : 400,
              color: step === s ? '#1e293b' : '#94a3b8',
            }}>
              {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Columns' : s === 'preview' ? 'Preview' : s === 'importing' ? 'Importing' : 'Done'}
            </span>
            {idx < 4 && <span style={{ color: '#d1d5db', margin: '0 0.25rem' }}>→</span>}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Upload ─────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div>
          {/* Source selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Data Source</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {([
                { value: 'custom' as const, label: 'Custom CSV', desc: 'Google Sheets or hand-built CSV' },
                { value: 'librarything' as const, label: 'LibraryThing Export', desc: 'TSV/CSV export from LibraryThing' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSource(opt.value)}
                  style={{
                    flex: 1, padding: '1rem', border: '2px solid',
                    borderColor: source === opt.value ? '#3b82f6' : '#e2e8f0',
                    borderRadius: '8px', background: source === opt.value ? '#eff6ff' : '#fff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '3rem',
              textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8fafc',
              transition: 'border-color 0.2s',
            }}
            onDragEnter={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6' }}
            onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1' }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              Drop your {source === 'librarything' ? 'LibraryThing export' : 'CSV'} file here
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              or click to browse — supports .csv and .tsv files
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileSelectWrapped}
              style={{ display: 'none' }}
            />
          </div>

          {/* Tips */}
          <div style={{
            marginTop: '1.5rem', padding: '1rem', borderRadius: '8px',
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#92400e' }}>
              {source === 'librarything' ? 'LibraryThing Export Tips' : 'CSV Format Tips'}
            </div>
            {source === 'librarything' ? (
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#78350f', lineHeight: 1.8 }}>
                <li>Go to <strong>LibraryThing → More → Import/Export</strong> (or visit librarything.com/export)</li>
                <li>Choose <strong>Comma-separated</strong> or <strong>Tab-separated</strong> — both work</li>
                <li>Include the <strong>"Book Id"</strong> column to import your custom cover images</li>
                <li>All columns are auto-detected: ISBN, author, tags, DDC, LCC, ratings, reviews, etc.</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#78350f', lineHeight: 1.8 }}>
                <li>Export from Google Sheets: <strong>File → Download → .csv</strong></li>
                <li>First row must be column headers</li>
                <li>Column names are auto-detected: isbn, title, author, pages, tags, genre, location, read, completed</li>
                <li>ISBN column enables richer API lookups (cover images, description, subjects, etc.)</li>
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 2: Column Mapping ──────────────────────────────────────── */}
      {step === 'mapping' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Column Mapping</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {fileName} — {rawRows.length} rows, {headers.length} columns
                {source === 'librarything' && ' (auto-detected as LibraryThing export)'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={resetImport} style={{ ...btnStyle, ...btnSecondaryStyle }}>Back</button>
              <button onClick={confirmMapping} style={{ ...btnStyle, ...btnPrimaryStyle }}>Confirm Mapping</button>
            </div>
          </div>

          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={thStyle}>CSV Column</th>
                  <th style={thStyle}>Sample Values</th>
                  <th style={thStyle}>Maps To</th>
                </tr>
              </thead>
              <tbody>
                {headers.map(header => {
                  const samples = rawRows.slice(0, 3).map(r => r[header]).filter(Boolean)
                  return (
                    <tr key={header} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{header}</td>
                      <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {samples.join(' | ') || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={columnMapping[header] || ''}
                          onChange={e => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          style={{
                            width: '100%', padding: '0.4rem', borderRadius: '6px',
                            border: '1px solid #d1d5db', fontSize: '0.85rem',
                            backgroundColor: columnMapping[header] ? '#eff6ff' : '#fff',
                          }}
                        >
                          {getTargetFields(source).map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview ─────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Preview Import</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {importRows.length} books ready to import — each will be enriched from book APIs before saving
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setStep('mapping')} style={{ ...btnStyle, ...btnSecondaryStyle }}>Back</button>
              <button onClick={startImport} style={{ ...btnStyle, ...btnPrimaryStyle }}>
                Start Import ({filteredImportRows.length} books)
              </button>
            </div>
          </div>

          {/* Duplicate options panel */}
          <div style={{
            marginBottom: '1rem', padding: '0.75rem 1rem',
            borderRadius: '8px', border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc', fontSize: '0.9rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={preScanDuplicates}
                disabled={dupScanLoading}
                style={{
                  ...btnStyle, fontSize: '0.85rem', padding: '0.4rem 0.85rem',
                  backgroundColor: dupScanDone ? '#dcfce7' : '#dbeafe',
                  color: dupScanDone ? '#16a34a' : '#2563eb',
                  border: `1px solid ${dupScanDone ? '#bbf7d0' : '#bfdbfe'}`,
                }}
              >
                {dupScanLoading ? 'Scanning...' : dupScanDone ? `✓ ${dupRowIndices.size} CSV duplicate${dupRowIndices.size !== 1 ? 's' : ''} found` : '🔍 Scan for Duplicates in CSV'}
              </button>

              {dupScanDone && (
                <div style={{ display: 'flex', gap: '0.25rem', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  {[
                    { value: 'all' as const, label: `All (${importRows.length})` },
                    { value: 'duplicates-only' as const, label: `CSV Dupes (${dupRowIndices.size})` },
                    { value: 'new-only' as const, label: `Unique (${importRows.length - dupRowIndices.size})` },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPreviewFilter(opt.value)}
                      style={{
                        padding: '0.35rem 0.75rem', border: 'none', fontSize: '0.8rem', fontWeight: 500,
                        cursor: 'pointer',
                        backgroundColor: previewFilter === opt.value ? '#3b82f6' : '#fff',
                        color: previewFilter === opt.value ? '#fff' : '#475569',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={allowDuplicates}
                  onChange={e => setAllowDuplicates(e.target.checked)}
                  style={{ width: '0.9rem', height: '0.9rem', accentColor: '#f59e0b' }}
                />
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Allow all duplicates</span>
              </label>
            </div>
            {dupScanDone && previewFilter === 'duplicates-only' && (
              <p style={{ margin: '0.5rem 0 0', color: '#b45309', fontSize: '0.8rem' }}>
                Only the {dupRowIndices.size} books already in your library will be imported (duplicates will be allowed automatically).
              </p>
            )}
            {dupScanDone && previewFilter === 'new-only' && (
              <p style={{ margin: '0.5rem 0 0', color: '#2563eb', fontSize: '0.8rem' }}>
                Only the {importRows.length - dupRowIndices.size} books NOT already in your library will be imported.
              </p>
            )}
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto', maxHeight: '60vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ ...thStyle, width: '40px' }}>#</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Author</th>
                  <th style={thStyle}>ISBN</th>
                  <th style={thStyle}>Tags</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredImportRows.map(({ row, originalIndex }) => (
                  <tr key={originalIndex} style={{
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: dupScanDone && dupRowIndices.has(originalIndex) ? '#fffbeb' : undefined,
                  }}>
                    <td style={{ ...tdStyle, color: '#94a3b8' }}>{originalIndex + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      {row.mapped.title || <span style={{ color: '#ef4444' }}>Missing</span>}
                      {dupScanDone && dupRowIndices.has(originalIndex) && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>DUP</span>
                      )}
                    </td>
                    <td style={tdStyle}>{row.mapped.author || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {row.mapped.isbn13 || row.mapped.isbn10 || <span style={{ color: '#d1d5db' }}>none</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.8rem' }}>
                      {row.mapped.categories?.join(', ') || '—'}
                    </td>
                    <td style={tdStyle}>{statusBadge(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Importing ────────────────────────────────────────────── */}
      {step === 'importing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Importing...</h2>
            <button onClick={cancelImport} style={{ ...btnStyle, background: '#ef4444', color: '#fff', border: 'none' }}>
              Cancel Import
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              <span>{importProgress.phase}</span>
              <span>{importProgress.current} / {importProgress.total}</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', backgroundColor: '#3b82f6',
                width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            {importProgress.current > 0 && importProgress.total > 0 && (() => {
              const pct = Math.round((importProgress.current / importProgress.total) * 100)
              const elapsed = (Date.now() - importStartTimeRef.current) / 1000
              const perItem = elapsed / importProgress.current
              const remaining = perItem * (importProgress.total - importProgress.current)
              const mins = Math.floor(remaining / 60)
              const secs = Math.round(remaining % 60)
              const eta = remaining < 2 ? 'almost done'
                : mins > 0 ? `~${mins}m ${secs}s remaining`
                : `~${secs}s remaining`
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  <span>{pct}% complete</span>
                  <span>{eta}</span>
                </div>
              )
            })()}
          </div>

          {/* Live status table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto', maxHeight: '50vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ ...thStyle, width: '40px' }}>#</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Author</th>
                  <th style={thStyle}>Sources</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((row, idx) => (
                  <tr
                    key={idx}
                    ref={row.status === 'enriching' || row.status === 'saving' ? activeRowRef : undefined}
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      backgroundColor: row.status === 'enriching' || row.status === 'saving' ? '#fffbeb' : undefined,
                    }}
                  >
                    <td style={{ ...tdStyle, color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{row.mapped.title}</td>
                    <td style={tdStyle}>{row.enrichedBook?.author || row.mapped.author || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: '0.75rem' }}>
                      {row.apiSources?.join(', ') || '—'}
                    </td>
                    <td style={tdStyle}>
                      {statusBadge(row.status)}
                      {row.error && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px' }}>{row.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── STEP 5: Done ────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div>
          <div style={{
            textAlign: 'center', padding: '2rem', backgroundColor: '#f0fdf4',
            borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Import Complete</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.95rem' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.5rem' }}>{importResults.saved}</span>
                <div style={{ color: '#64748b' }}>Saved</div>
              </div>
              {importResults.errors > 0 && (
                <div>
                  <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.5rem' }}>{importResults.errors}</span>
                  <div style={{ color: '#64748b' }}>Errors</div>
                </div>
              )}
              {importResults.skipped > 0 && (
                <div>
                  <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '1.5rem' }}>{importResults.skipped}</span>
                  <div style={{ color: '#64748b' }}>Skipped</div>
                </div>
              )}
              {importResults.duplicates > 0 && (
                <div>
                  <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.5rem' }}>{importResults.duplicates}</span>
                  <div style={{ color: '#64748b' }}>Duplicates</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={resetImport} style={{ ...btnStyle, ...btnSecondaryStyle }}>Import More</button>
            {importResults.duplicates > 0 && (
              <>
                <button onClick={retryDuplicates} style={{ ...btnStyle, backgroundColor: '#f59e0b', color: '#fff' }}>
                  Re-import {importResults.duplicates} Duplicate{importResults.duplicates !== 1 ? 's' : ''}
                </button>
                <button onClick={exportDuplicatesCsv} style={{ ...btnStyle, ...btnSecondaryStyle }}>
                  ⬇ Export Duplicates CSV
                </button>
              </>
            )}
            <a href="/library" style={{ ...btnStyle, ...btnPrimaryStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              View Library
            </a>
          </div>

          {/* Error details */}
          {importResults.errors > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Errors</h3>
              <div style={{ border: '1px solid #fecaca', borderRadius: '8px', overflow: 'hidden' }}>
                {importRows.filter(r => r.status === 'error').map((row, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem 1rem', borderTop: idx > 0 ? '1px solid #fecaca' : undefined,
                    backgroundColor: '#fff5f5',
                  }}>
                    <strong>{row.mapped.title}</strong>
                    {row.mapped.author && <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>by {row.mapped.author}</span>}
                    <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {row.error}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate details */}
          {importResults.duplicates > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Duplicates Skipped</h3>
              <div style={{ border: '1px solid #fde68a', borderRadius: '8px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
                {importRows.filter(r => r.status === 'duplicate').map((row, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem 1rem', borderTop: idx > 0 ? '1px solid #fde68a' : undefined,
                    backgroundColor: '#fffbeb',
                  }}>
                    <strong>{row.mapped.title}</strong>
                    {row.mapped.author && <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>by {row.mapped.author}</span>}
                    {(row.mapped.isbn13 || row.mapped.isbn10) && (
                      <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        ISBN: {row.mapped.isbn13 || row.mapped.isbn10}
                      </span>
                    )}
                    <div style={{ color: '#b45309', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {row.dupReason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped details */}
          {importResults.skipped > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Skipped</h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {importRows.filter(r => r.status === 'skipped').map((row, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem 1rem', borderTop: idx > 0 ? '1px solid #e2e8f0' : undefined,
                    backgroundColor: '#f8fafc',
                  }}>
                    <strong>Row {row.rowIndex + 1}</strong>
                    {row.mapped.title && <span style={{ marginLeft: '0.5rem' }}>{row.mapped.title}</span>}
                    <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                      {row.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared button styles ───────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  border: 'none',
  transition: 'background-color 0.15s',
}

const btnPrimaryStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: '#fff',
}

const btnSecondaryStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  fontSize: '0.85rem',
}
