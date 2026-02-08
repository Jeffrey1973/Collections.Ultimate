import { useState } from 'react'
import { Book } from '../api/books'

interface CardCatalogViewProps {
  book: Book
  displayFields?: string[]
}

type CardType = 'author' | 'title' | 'subject'

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  width: '100%',
  maxWidth: '550px',
  backgroundColor: '#f5f1e8',
  border: '2px solid #8b7355',
  borderTop: 'none',
  borderRadius: '0 0 4px 4px',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  fontFamily: '"Courier New", monospace',
  padding: '1.5rem 1.5rem 1.25rem',
  position: 'relative',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  color: '#2c2417',
}

const holePunch = (top: number): React.CSSProperties => ({
  position: 'absolute',
  top,
  left: 15,
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: '#333',
})

const indent: React.CSSProperties = { marginLeft: '2.5rem' }
const divider: React.CSSProperties = { borderTop: '1px solid #8b7355', margin: '0.6rem 0' }
const dashedDivider: React.CSSProperties = { borderTop: '1px dashed #8b7355', margin: '0.6rem 0' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatArray(arr: any[] | undefined): string | null {
  if (!arr || arr.length === 0) return null
  return arr.map(v => (typeof v === 'object' ? (v.text || v.name || JSON.stringify(v)) : v)).join(', ')
}

function getCallNumber(book: Book): string | null {
  return book.callNumber || book.deweyDecimal || book.lcc || null
}

function getIsbnDisplay(book: Book): string | null {
  if (book.isbn13) return book.isbn13
  if (book.isbn10) return book.isbn10
  return book.isbn || null
}

function buildTitleStatement(book: Book): string {
  let s = book.title
  if (book.subtitle) s += ` : ${book.subtitle}`
  if (book.byStatement) {
    s += ` / ${book.byStatement}`
  } else if (book.author) {
    s += ` / by ${book.author}`
  }
  return s
}

function buildPhysicalDescription(book: Book): string | null {
  if (book.physicalDescription) return book.physicalDescription
  const parts: string[] = []
  if (book.pagination) parts.push(book.pagination)
  else if (book.pageCount) parts.push(`${book.pageCount} p.`)
  if (book.illustrator) parts.push('ill.')
  if (book.dimensions) {
    parts.push(parts.length ? `; ${book.dimensions}` : book.dimensions)
  } else if (book.dimensionsHeight) {
    parts.push(parts.length ? `; ${book.dimensionsHeight} cm` : `${book.dimensionsHeight} cm`)
  }
  return parts.length ? parts.join(' ') : null
}

function getAddedEntries(book: Book): string[] {
  const entries: string[] = []
  if (book.editor) entries.push(`${book.editor}, ed.`)
  if (book.translator) entries.push(`${book.translator}, tr.`)
  if (book.illustrator) entries.push(`${book.illustrator}, ill.`)
  if (book.narrator) entries.push(`${book.narrator}, narr.`)
  if (book.contributors) {
    book.contributors.forEach(c => {
      const role = c.role ? `, ${c.role}` : ''
      entries.push(`${c.name}${role}`)
    })
  }
  return entries
}

function getNotesLines(book: Book): string[] {
  const notes: string[] = []
  if (book.bibliography) notes.push(book.bibliography)
  if (book.notes) notes.push(book.notes)
  if (book.originalLanguage || book.translatedFrom) {
    const from = book.translatedFrom || book.originalLanguage
    notes.push(`Translation of: ${from}`)
  }
  if (book.printingHistory) notes.push(book.printingHistory)
  if (book.colophon) notes.push(book.colophon)
  if (book.printRun) notes.push(book.printRun)
  if (book.awards && book.awards.length > 0) notes.push(`Awards: ${book.awards.join('; ')}`)
  return notes
}

function getSubjectHeadings(book: Book): string[] {
  const headings: string[] = []

  const addUnique = (items: string[] | string | undefined) => {
    if (!items) return
    // Handle single comma-separated string (e.g. "Cycling, Philosophy, Sports & Recreation")
    const arr = typeof items === 'string'
      ? items.split(',').map(s => s.trim()).filter(Boolean)
      : items
    arr.forEach(s => {
      if (s && !headings.includes(s)) headings.push(s)
    })
  }

  // Subjects (from backend subjects field)
  addUnique(book.subjects)
  // Categories / Tags (tags from backend are mapped to categories)
  addUnique(book.categories)
  // FAST subjects
  addUnique(book.fastSubjects)
  // mainCategory as fallback
  addUnique(book.mainCategory)
  // Also try tags directly in case backend shape differs
  addUnique((book as any).tags)

  return headings
}

// ─── Single Card Renderer ────────────────────────────────────────────────────

function CatalogCard({ book, type, displayFields }: { book: Book; type: CardType; displayFields?: string[] }) {
  const callNumber = getCallNumber(book)
  const titleStatement = buildTitleStatement(book)
  const physDesc = buildPhysicalDescription(book)
  const subjectHeadings = getSubjectHeadings(book)
  const addedEntries = getAddedEntries(book)
  const notesLines = getNotesLines(book)
  const isbnDisplay = getIsbnDisplay(book)

  // Extra fields from user-selected displayFields that aren't natively shown on the card
  const NATIVE_KEYS = new Set([
    'id', 'householdId', 'dateAdded', 'title', 'subtitle', 'author', 'edition',
    'editionStatement', 'publisher', 'publishedDate', 'placeOfPublication',
    'pageCount', 'pagination', 'dimensions', 'dimensionsHeight', 'dimensionsWidth',
    'dimensionsThickness', 'physicalDescription', 'series', 'seriesInfo',
    'numberOfVolumes', 'volumeNumber', 'notes', 'subjects', 'categories',
    'fastSubjects', 'isbn', 'isbn10', 'isbn13', 'callNumber', 'deweyDecimal',
    'lcc', 'dataSources', 'coverImageUrl', 'editor', 'translator', 'illustrator',
    'narrator', 'contributors', 'bibliography', 'byStatement', 'originalLanguage',
    'translatedFrom', 'printingHistory', 'colophon', 'printRun', 'awards',
    'description', 'coverImageSmallThumbnail', 'coverImageThumbnail',
    'coverImageSmall', 'coverImageMedium', 'coverImageLarge', 'coverImageExtraLarge',
    'originalTitle', 'otherTitles', 'language', 'format', 'binding', 'printType',
    'copyright', 'lccn', 'oclcNumber', 'issn',
  ])
  const extraFields = (displayFields ?? [])
    .filter(key => !NATIVE_KEYS.has(key))
    .map(key => {
      const val = (book as any)[key]
      if (val === null || val === undefined || val === '') return null
      const display = Array.isArray(val)
        ? formatArray(val)
        : typeof val === 'boolean' ? (val ? 'Yes' : 'No')
        : typeof val === 'object' ? JSON.stringify(val)
        : String(val)
      if (!display) return null
      return { key, display }
    })
    .filter(Boolean) as { key: string; display: string }[]

  return (
    <div style={cardBase}>
      {/* Hole punches */}
      <div style={holePunch(20)} />
      <div style={holePunch(55)} />

      <div style={{ paddingLeft: '30px' }}>

        {/* ═══ TOP HEADING — varies by card type ═══ */}

        {type === 'subject' && subjectHeadings.length > 0 && (
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 'bold',
            color: '#c41e3a',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.6rem',
            borderBottom: '1px solid #c41e3a',
            paddingBottom: '0.3rem',
          }}>
            {subjectHeadings[0]}
          </div>
        )}

        {type === 'title' && (
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 'bold',
            color: '#1a3a5c',
            marginBottom: '0.6rem',
            borderBottom: '1px solid #1a3a5c',
            paddingBottom: '0.3rem',
          }}>
            {book.title}
            {book.subtitle ? ` : ${book.subtitle}` : ''}
          </div>
        )}

        {/* ═══ 1. CORE IDENTIFYING INFORMATION ═══ */}

        {/* Call Number */}
        {callNumber && (
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 'bold',
            color: '#c41e3a',
            fontFamily: '"Courier New", monospace',
            marginBottom: '0.35rem',
          }}>
            {callNumber}
            {book.deweyDecimal && book.lcc && callNumber === book.deweyDecimal
              ? ` [LC: ${book.lcc}]`
              : book.deweyDecimal && callNumber !== book.deweyDecimal
                ? ` [DDC: ${book.deweyDecimal}]`
                : ''
            }
          </div>
        )}

        {/* Main Entry (Author) */}
        <div style={{
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginBottom: '0.25rem',
        }}>
          {book.author || 'UNKNOWN AUTHOR'}
        </div>

        {/* Title and Responsibility */}
        <div style={{ ...indent, marginBottom: '0.4rem' }}>
          {titleStatement}
        </div>

        {/* ═══ 2. PUBLICATION AND EDITION ═══ */}
        <div style={divider} />

        {/* Edition statement */}
        {(book.edition || book.editionStatement) && (
          <div style={{ ...indent, marginBottom: '0.25rem' }}>
            {book.editionStatement || `${book.edition} ed.`}
          </div>
        )}

        {/* Imprint: Place : Publisher, Date */}
        <div style={indent}>
          {[
            book.placeOfPublication,
            book.publisher ? (book.placeOfPublication ? `: ${book.publisher}` : book.publisher) : null,
            book.publishedDate ? (book.publisher || book.placeOfPublication ? `, ${book.publishedDate}` : book.publishedDate) : null,
          ].filter(Boolean).join(' ') || 'Publication details unknown'}
          {book.copyright && book.copyright !== book.publishedDate ? ` (©${book.copyright})` : ''}
        </div>

        {/* ═══ 3. PHYSICAL DESCRIPTION ═══ */}
        <div style={divider} />

        {physDesc && (
          <div style={{ ...indent, marginBottom: '0.25rem' }}>
            {physDesc}
          </div>
        )}

        {/* Series note */}
        {(book.series || book.seriesInfo?.seriesName) && (
          <div style={{ ...indent, fontStyle: 'italic', marginBottom: '0.25rem' }}>
            ({book.seriesInfo?.seriesName || book.series}
            {(book.volumeNumber || book.seriesInfo?.volumeNumber) &&
              ` ; v. ${book.seriesInfo?.volumeNumber || book.volumeNumber}`}
            {book.numberOfVolumes && book.numberOfVolumes > 1 && ` — ${book.numberOfVolumes} vols.`}
            )
          </div>
        )}

        {/* Format / binding / print type */}
        {(book.format || book.binding || book.printType) && (
          <div style={{ ...indent, fontSize: '0.8rem', color: '#555', marginBottom: '0.25rem' }}>
            {[book.format, book.binding, book.printType].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* ═══ 4. NOTES ═══ */}
        {notesLines.length > 0 && (
          <>
            <div style={divider} />
            {notesLines.map((note, i) => (
              <div key={i} style={{ ...indent, fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                {note}
              </div>
            ))}
          </>
        )}

        {/* Alternative Titles */}
        {book.originalTitle && book.originalTitle !== book.title && (
          <div style={{ ...indent, fontSize: '0.8rem', marginBottom: '0.2rem' }}>
            Original title: <em>{book.originalTitle}</em>
          </div>
        )}
        {book.otherTitles && book.otherTitles.length > 0 && (
          <div style={{ ...indent, fontSize: '0.8rem', marginBottom: '0.2rem' }}>
            Also known as: {book.otherTitles.join('; ')}
          </div>
        )}

        {/* Language */}
        {book.language && book.language !== 'en' && (
          <div style={{ ...indent, fontSize: '0.8rem', marginBottom: '0.2rem' }}>
            Language: {book.language}
          </div>
        )}

        {/* ═══ 5. SUBJECT HEADINGS & TRACINGS ═══ */}
        <div style={divider} />

        {subjectHeadings.length > 0 && (
          <div style={{ marginBottom: '0.4rem' }}>
            {subjectHeadings.map((subject, i) => (
              <div key={i} style={{ fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                <span style={{ display: 'inline-block', width: '1.5rem', textAlign: 'right', marginRight: '0.4rem', color: '#888' }}>
                  {i + 1}.
                </span>
                <span style={{
                  textTransform: 'uppercase',
                  fontWeight: type === 'subject' && i === 0 ? 'bold' : 'normal',
                  color: type === 'subject' && i === 0 ? '#c41e3a' : undefined,
                }}>
                  {subject}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Added Entries */}
        {addedEntries.length > 0 && (
          <div style={{ marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.15rem' }}>
              Added entries:
            </span>
            {addedEntries.map((entry, i) => (
              <div key={i} style={{ fontSize: '0.8rem', marginLeft: '2rem', marginBottom: '0.1rem' }}>
                {String.fromCharCode(73 + i)}. {entry}
              </div>
            ))}
          </div>
        )}

        {/* ISBN and other identifiers */}
        <div style={{ marginTop: '0.35rem' }}>
          {isbnDisplay && (
            <div style={{ fontSize: '0.8rem' }}>
              ISBN {isbnDisplay}
              {book.isbn10 && book.isbn13 && ` (ISBN-10: ${book.isbn10})`}
            </div>
          )}
          {book.lccn && <div style={{ fontSize: '0.8rem' }}>LCCN {book.lccn}</div>}
          {book.oclcNumber && <div style={{ fontSize: '0.8rem' }}>OCLC {book.oclcNumber}</div>}
          {book.issn && <div style={{ fontSize: '0.8rem' }}>ISSN {book.issn}</div>}
        </div>

        {/* ═══ EXTRA USER-SELECTED FIELDS ═══ */}
        {extraFields.length > 0 && (
          <>
            <div style={dashedDivider} />
            {extraFields.map(({ key, display }) => (
              <div key={key} style={{ fontSize: '0.78rem', marginBottom: '0.15rem', color: '#555' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()}:
                </span>{' '}
                {display}
              </div>
            ))}
          </>
        )}

        {/* ═══ LIBRARY STAMP ═══ */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '0.6rem',
          borderTop: '1px dashed #8b7355',
          fontSize: '0.7rem',
          color: '#777',
          textAlign: 'center',
          letterSpacing: '0.1em',
        }}>
          COLLECTIONS ULTIMATE LIBRARY
          <div style={{ marginTop: '0.15rem' }}>
            Cataloged: {new Date(book.dateAdded).toLocaleDateString()}
          </div>
          {book.dataSources && book.dataSources.length > 0 && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.65rem', color: '#999', fontStyle: 'italic', letterSpacing: 0 }}>
              Sources: {book.dataSources.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Card type badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 10,
        fontSize: '0.6rem',
        fontWeight: 700,
        color: type === 'subject' ? '#c41e3a' : type === 'title' ? '#1a3a5c' : '#5c4b2e',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.6,
      }}>
        {type} card
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

function CardCatalogView({ book, displayFields }: CardCatalogViewProps) {
  const [activeCard, setActiveCard] = useState<CardType>('author')
  const subjectHeadings = getSubjectHeadings(book)

  const tabStyle = (type: CardType): React.CSSProperties => ({
    padding: '0.45rem 1rem',
    fontSize: '0.8rem',
    fontWeight: activeCard === type ? 700 : 400,
    fontFamily: '"Courier New", monospace',
    color: activeCard === type
      ? (type === 'subject' ? '#c41e3a' : type === 'title' ? '#1a3a5c' : '#5c4b2e')
      : '#8b7355',
    background: activeCard === type ? '#f5f1e8' : 'transparent',
    border: activeCard === type ? '2px solid #8b7355' : '2px solid transparent',
    borderBottom: activeCard === type ? '2px solid #f5f1e8' : '2px solid transparent',
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
    marginBottom: '-2px',
    transition: 'color 0.15s',
  })

  return (
    <div style={{ width: '100%', maxWidth: '550px', margin: '0 auto' }}>
      {/* Card type tabs */}
      <div style={{
        display: 'flex',
        gap: '0.15rem',
        borderBottom: '2px solid #8b7355',
        marginBottom: 0,
        paddingLeft: '30px',
      }}>
        <button style={tabStyle('author')} onClick={(e) => { e.stopPropagation(); setActiveCard('author') }}>
          ✍️ Author
        </button>
        <button style={tabStyle('title')} onClick={(e) => { e.stopPropagation(); setActiveCard('title') }}>
          📖 Title
        </button>
        <button
          style={{
            ...tabStyle('subject'),
            opacity: subjectHeadings.length === 0 ? 0.4 : 1,
          }}
          disabled={subjectHeadings.length === 0}
          onClick={(e) => { e.stopPropagation(); setActiveCard('subject') }}
          title={subjectHeadings.length === 0 ? 'No subject headings available' : undefined}
        >
          🏷️ Subject
        </button>
      </div>

      <CatalogCard book={book} type={activeCard} displayFields={displayFields} />
    </div>
  )
}

export default CardCatalogView
