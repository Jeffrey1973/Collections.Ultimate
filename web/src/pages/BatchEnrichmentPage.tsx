/**
 * BatchEnrichmentPage — processes multiple books through external API enrichment,
 * shows progress, per-book diffs, and lets users review + apply selectively.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getItem, mapItemResponseToBook } from '../api/backend'
import { Book } from '../api/books'
import { enrichBook, applyEnrichment, type EnrichmentResult, type FieldDiff } from '../api/enrichment'
import EnrichmentPreview from '../components/EnrichmentPreview'

type BookStatus = 'pending' | 'loading' | 'enriched' | 'applied' | 'skipped' | 'error'

interface BookEnrichmentState {
  bookId: string
  book: Book | null
  status: BookStatus
  result: EnrichmentResult | null
  progress: string
  selectedDiffs: FieldDiff[]
  error?: string
}

export default function BatchEnrichmentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [bookStates, setBookStates] = useState<BookEnrichmentState[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null)
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const abortRef = useRef(false)

  // Parse book IDs from URL
  const bookIds = (searchParams.get('ids') || '').split(',').filter(Boolean)

  // Load book data on mount
  useEffect(() => {
    if (bookIds.length === 0) return
    const states: BookEnrichmentState[] = bookIds.map(id => ({
      bookId: id,
      book: null,
      status: 'pending' as BookStatus,
      result: null,
      progress: '',
      selectedDiffs: [],
    }))
    setBookStates(states)
  }, [searchParams.get('ids')])

  // Start batch enrichment
  async function startEnrichment() {
    if (bookStates.length === 0) return
    setIsRunning(true)
    abortRef.current = false

    for (let i = 0; i < bookStates.length; i++) {
      if (abortRef.current) break
      setCurrentIndex(i)

      // Update status to loading
      setBookStates(prev => {
        const next = [...prev]
        next[i] = { ...next[i], status: 'loading', progress: 'Loading book data...' }
        return next
      })

      try {
        // Load the book data
        const item = await getItem(bookStates[i].bookId)
        const book = mapItemResponseToBook(item) as Book

        setBookStates(prev => {
          const next = [...prev]
          next[i] = { ...next[i], book, progress: 'Searching APIs...' }
          return next
        })

        // Enrich
        const result = await enrichBook(book, (_cur, _tot, status) => {
          setBookStates(prev => {
            const next = [...prev]
            next[i] = { ...next[i], progress: status }
            return next
          })
        })

        // Pre-select new fields
        const autoSelected = result.diffs.filter(d => d.isNewField)

        setBookStates(prev => {
          const next = [...prev]
          next[i] = {
            ...next[i],
            book,
            status: result.diffs.length > 0 ? 'enriched' : 'skipped',
            result,
            progress: result.diffs.length > 0
              ? `${result.diffs.length} field${result.diffs.length !== 1 ? 's' : ''} found`
              : 'No new data',
            selectedDiffs: autoSelected,
            error: result.error,
          }
          return next
        })
      } catch (err: any) {
        setBookStates(prev => {
          const next = [...prev]
          next[i] = {
            ...next[i],
            status: 'error',
            progress: '',
            error: err.message || 'Failed to enrich',
          }
          return next
        })
      }

      // Small delay between books to avoid rate limiting
      if (i < bookStates.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    setIsRunning(false)
    setCurrentIndex(-1)
  }

  function stopEnrichment() {
    abortRef.current = true
  }

  // Apply individual book enrichment
  async function applyBook(index: number) {
    const state = bookStates[index]
    if (!state.book || !state.result || state.selectedDiffs.length === 0) return

    setBookStates(prev => {
      const next = [...prev]
      next[index] = { ...next[index], progress: 'Applying...', status: 'loading' }
      return next
    })

    try {
      await applyEnrichment(state.book, state.selectedDiffs, state.result.apiData, state.result.dataSources)
      setBookStates(prev => {
        const next = [...prev]
        next[index] = { ...next[index], status: 'applied', progress: `${state.selectedDiffs.length} fields applied` }
        return next
      })
    } catch (err: any) {
      setBookStates(prev => {
        const next = [...prev]
        next[index] = { ...next[index], status: 'error', error: err.message || 'Apply failed' }
        return next
      })
    }
  }

  // Apply all enriched books
  async function applyAll() {
    setIsApplyingAll(true)
    for (let i = 0; i < bookStates.length; i++) {
      const state = bookStates[i]
      if (state.status === 'enriched' && state.selectedDiffs.length > 0) {
        await applyBook(i)
      }
    }
    setIsApplyingAll(false)
  }

  // Summary stats
  const pendingCount = bookStates.filter(s => s.status === 'pending').length
  const enrichedCount = bookStates.filter(s => s.status === 'enriched').length
  const appliedCount = bookStates.filter(s => s.status === 'applied').length
  const skippedCount = bookStates.filter(s => s.status === 'skipped').length
  const errorCount = bookStates.filter(s => s.status === 'error').length
  const totalDiffsFound = bookStates.reduce((sum, s) => sum + (s.result?.diffs.length || 0), 0)
  const progressPercent = bookStates.length > 0
    ? Math.round(((bookStates.length - pendingCount) / bookStates.length) * 100)
    : 0

  if (bookIds.length === 0) {
    return (
      <div>
        <div className="page-header">
          <button onClick={() => navigate('/library')} className="btn btn-secondary">
            ← Back to Library
          </button>
          <h1 className="page-title">Batch Enrichment</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>No books selected for enrichment.</p>
          <button onClick={() => navigate('/library')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Go to Library
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <button onClick={() => navigate('/library')} className="btn btn-secondary" style={{ marginBottom: '0.5rem' }}>
              ← Back to Library
            </button>
            <h1 className="page-title" style={{ margin: 0 }}>Batch Enrichment</h1>
            <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0' }}>
              Enriching {bookStates.length} book{bookStates.length !== 1 ? 's' : ''} from external APIs
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isRunning && pendingCount > 0 && (
              <button
                onClick={startEnrichment}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
                  backgroundColor: '#10b981', color: 'white', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                🔍 Start Enrichment
              </button>
            )}
            {isRunning && (
              <button
                onClick={stopEnrichment}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid #ef4444',
                  backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                ⏹ Stop
              </button>
            )}
            {!isRunning && enrichedCount > 0 && (
              <button
                onClick={applyAll}
                disabled={isApplyingAll}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
                  backgroundColor: isApplyingAll ? '#cbd5e1' : '#2563eb', color: 'white',
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: isApplyingAll ? 'wait' : 'pointer',
                }}
              >
                {isApplyingAll ? '⏳ Applying...' : `✓ Apply All (${enrichedCount})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {(isRunning || progressPercent > 0) && (
        <div style={{
          backgroundColor: 'white', borderRadius: '8px', padding: '1rem 1.5rem',
          marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
              {isRunning ? `Processing book ${currentIndex + 1} of ${bookStates.length}...` : 'Complete'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{progressPercent}%</span>
          </div>
          <div style={{
            height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', backgroundColor: isRunning ? '#3b82f6' : '#10b981',
              borderRadius: '4px', transition: 'width 0.3s',
              width: `${progressPercent}%`,
            }} />
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap',
          }}>
            {enrichedCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#2563eb' }}>
                ✦ {enrichedCount} enriched ({totalDiffsFound} total fields)
              </span>
            )}
            {appliedCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                ✓ {appliedCount} applied
              </span>
            )}
            {skippedCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                — {skippedCount} no new data
              </span>
            )}
            {errorCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                ✕ {errorCount} errors
              </span>
            )}
          </div>
        </div>
      )}

      {/* Book List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {bookStates.map((state, index) => {
          const isExpanded = expandedBookId === state.bookId
          return (
            <div
              key={state.bookId}
              style={{
                backgroundColor: 'white', borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden',
                border: state.status === 'loading' ? '2px solid #3b82f6'
                  : state.status === 'enriched' ? '2px solid #10b981'
                  : state.status === 'applied' ? '2px solid #16a34a'
                  : state.status === 'error' ? '2px solid #ef4444'
                  : '2px solid transparent',
              }}
            >
              {/* Row header */}
              <div
                onClick={() => {
                  if (state.result && state.result.diffs.length > 0) {
                    setExpandedBookId(isExpanded ? null : state.bookId)
                  }
                }}
                style={{
                  padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center',
                  gap: '0.75rem', cursor: state.result?.diffs.length ? 'pointer' : 'default',
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem',
                  backgroundColor:
                    state.status === 'pending' ? '#f1f5f9'
                    : state.status === 'loading' ? '#eff6ff'
                    : state.status === 'enriched' ? '#ecfdf5'
                    : state.status === 'applied' ? '#f0fdf4'
                    : state.status === 'skipped' ? '#f8fafc'
                    : '#fef2f2',
                }}>
                  {state.status === 'pending' && '⏳'}
                  {state.status === 'loading' && '⟳'}
                  {state.status === 'enriched' && '✦'}
                  {state.status === 'applied' && '✓'}
                  {state.status === 'skipped' && '—'}
                  {state.status === 'error' && '✕'}
                </div>

                {/* Book info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.9rem', fontWeight: 600, color: '#1e293b',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {state.book?.title || `Book ${state.bookId.substring(0, 8)}...`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {state.book?.author || ''}
                    {state.progress && (
                      <span style={{ marginLeft: '0.5rem', color: '#3b82f6' }}>
                        — {state.progress}
                      </span>
                    )}
                    {state.error && !state.result && (
                      <span style={{ marginLeft: '0.5rem', color: '#dc2626' }}>
                        — {state.error}
                      </span>
                    )}
                  </div>
                </div>

                {/* Result summary */}
                {state.result && state.result.diffs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                      backgroundColor: state.result.diffs.filter(d => d.isNewField).length > 0 ? '#dcfce7' : '#fef3c7',
                      color: state.result.diffs.filter(d => d.isNewField).length > 0 ? '#166534' : '#92400e',
                      fontWeight: 500,
                    }}>
                      {state.result.diffs.filter(d => d.isNewField).length} new,{' '}
                      {state.result.diffs.filter(d => !d.isNewField).length} updates
                    </span>

                    {state.status === 'enriched' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          applyBook(index)
                        }}
                        style={{
                          padding: '0.3rem 0.75rem', borderRadius: '6px', border: 'none',
                          backgroundColor: '#2563eb', color: 'white', fontSize: '0.75rem',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Apply ({state.selectedDiffs.length})
                      </button>
                    )}

                    {state.status === 'applied' && (
                      <span style={{
                        fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                        backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600,
                      }}>
                        ✓ Applied
                      </span>
                    )}

                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                )}
              </div>

              {/* Expanded: inline EnrichmentPreview */}
              {isExpanded && state.result && state.result.diffs.length > 0 && state.book && (
                <div style={{ borderTop: '1px solid #e2e8f0' }}>
                  <EnrichmentPreview
                    result={state.result}
                    onApply={(diffs) => {
                      // Update selectedDiffs first, then apply
                      setBookStates(prev => {
                        const next = [...prev]
                        next[index] = { ...next[index], selectedDiffs: diffs }
                        return next
                      })
                      // Apply after state update
                      setTimeout(() => applyBook(index), 50)
                    }}
                    onCancel={() => setExpandedBookId(null)}
                    isApplying={state.status === 'loading'}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
