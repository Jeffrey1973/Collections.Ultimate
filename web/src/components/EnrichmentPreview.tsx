/**
 * EnrichmentPreview — shows a field-by-field diff between current book data
 * and API-enriched data. Users can select which fields to accept.
 */

import { useState, useMemo } from 'react'
import type { FieldDiff, EnrichmentResult } from '../api/enrichment'
import { formatDiffValue } from '../api/enrichment'

interface EnrichmentPreviewProps {
  result: EnrichmentResult
  onApply: (selectedDiffs: FieldDiff[]) => void
  onCancel: () => void
  isApplying?: boolean
}

export default function EnrichmentPreview({ result, onApply, onCancel, isApplying }: EnrichmentPreviewProps) {
  // Pre-select all "new field" diffs (empty → value), deselect overwrites
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const diff of result.diffs) {
      if (diff.isNewField) {
        initial.add(diff.key)
      }
    }
    return initial
  })

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(
    [...new Set(result.diffs.map(d => d.category))]
  ))

  // Group diffs by category
  const grouped = useMemo(() => {
    const groups: Record<string, FieldDiff[]> = {}
    for (const diff of result.diffs) {
      if (!groups[diff.category]) groups[diff.category] = []
      groups[diff.category].push(diff)
    }
    return groups
  }, [result.diffs])

  const categoryOrder = Object.keys(grouped)
  const totalDiffs = result.diffs.length
  const selectedCount = selected.size
  const newFieldCount = result.diffs.filter(d => d.isNewField).length
  const overwriteCount = result.diffs.filter(d => !d.isNewField).length

  function toggleField(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  function selectAll() {
    setSelected(new Set(result.diffs.map(d => d.key)))
  }

  function selectNone() {
    setSelected(new Set())
  }

  function selectNewOnly() {
    setSelected(new Set(result.diffs.filter(d => d.isNewField).map(d => d.key)))
  }

  function toggleCategory(cat: string) {
    const next = new Set(expandedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExpandedCategories(next)
  }

  if (result.error) {
    return (
      <div style={{
        padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
        borderRadius: '8px', marginTop: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: '#dc2626' }}>Enrichment Error</span>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b',
          }}>✕</button>
        </div>
        <p style={{ color: '#991b1b', fontSize: '0.875rem' }}>{result.error}</p>
      </div>
    )
  }

  if (totalDiffs === 0) {
    return (
      <div style={{
        padding: '1.5rem', backgroundColor: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: '8px', marginTop: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: '#16a34a' }}>✓ Book is fully enriched</span>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b',
          }}>✕</button>
        </div>
        <p style={{ color: '#166534', fontSize: '0.875rem' }}>
          No new data found from external APIs. Your book data is already complete!
          {result.dataSources.length > 0 && (
            <span style={{ display: 'block', marginTop: '0.25rem', color: '#4ade80' }}>
              Checked: {result.dataSources.join(', ')}
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '1rem', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🔍 Enrichment Results
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
            Found <strong>{totalDiffs}</strong> field{totalDiffs !== 1 ? 's' : ''} to update
            {newFieldCount > 0 && <span style={{ color: '#16a34a' }}> ({newFieldCount} new</span>}
            {overwriteCount > 0 && <span style={{ color: '#f59e0b' }}>{newFieldCount > 0 ? ', ' : ' ('}{overwriteCount} update{overwriteCount !== 1 ? 's' : ''}</span>}
            {(newFieldCount > 0 || overwriteCount > 0) && ')'}
            {result.dataSources.length > 0 && (
              <span style={{ display: 'block', marginTop: '0.15rem' }}>
                Sources: {result.dataSources.join(', ')}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={selectAll} style={pillButtonStyle('#eff6ff', '#2563eb', '#bfdbfe')}>
            Select All ({totalDiffs})
          </button>
          <button onClick={selectNewOnly} style={pillButtonStyle('#f0fdf4', '#16a34a', '#bbf7d0')}>
            New Only ({newFieldCount})
          </button>
          <button onClick={selectNone} style={pillButtonStyle('#f8fafc', '#64748b', '#e2e8f0')}>
            None
          </button>
        </div>
      </div>

      {/* Field diffs grouped by category */}
      <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {categoryOrder.map(cat => {
          const diffs = grouped[cat]
          const isExpanded = expandedCategories.has(cat)
          const catSelected = diffs.filter(d => selected.has(d.key)).length

          return (
            <div key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                style={{
                  width: '100%', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', background: '#f8fafc', border: 'none',
                  borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '0.875rem',
                  fontWeight: 600, color: '#334155', textAlign: 'left',
                }}
              >
                <span>{isExpanded ? '▼' : '▶'} {cat} ({diffs.length})</span>
                <span style={{ fontSize: '0.75rem', color: catSelected > 0 ? '#2563eb' : '#94a3b8' }}>
                  {catSelected} selected
                </span>
              </button>

              {isExpanded && (
                <div>
                  {diffs.map(diff => (
                    <label
                      key={diff.key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        padding: '0.75rem 1.5rem', borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer', backgroundColor: selected.has(diff.key) ? '#fafbff' : 'white',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = selected.has(diff.key) ? '#f0f4ff' : '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = selected.has(diff.key) ? '#fafbff' : 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(diff.key)}
                        onChange={() => toggleField(diff.key)}
                        style={{ marginTop: '0.2rem', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {diff.label}
                          </span>
                          {diff.isNewField ? (
                            <span style={{
                              fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                              backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600,
                            }}>NEW</span>
                          ) : (
                            <span style={{
                              fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                              backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 600,
                            }}>UPDATE</span>
                          )}
                        </div>

                        {/* Current value (if exists) */}
                        {!diff.isNewField && (
                          <div style={{
                            fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.15rem',
                            textDecoration: 'line-through', wordBreak: 'break-word',
                          }}>
                            {formatDiffValue(diff.currentValue)}
                          </div>
                        )}

                        {/* New value */}
                        <div style={{
                          fontSize: '0.8rem', color: diff.isNewField ? '#16a34a' : '#2563eb',
                          wordBreak: 'break-word',
                        }}>
                          {diff.key === 'coverImageUrl' && typeof diff.newValue === 'string' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <img
                                src={diff.newValue}
                                alt="New cover"
                                style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '3px' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <span style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all' }}>{diff.newValue.substring(0, 60)}...</span>
                            </div>
                          ) : (
                            formatDiffValue(diff.newValue)
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {selectedCount} of {totalDiffs} field{totalDiffs !== 1 ? 's' : ''} selected
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onCancel}
            disabled={isApplying}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db',
              backgroundColor: 'white', color: '#374151', fontSize: '0.85rem', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(result.diffs.filter(d => selected.has(d.key)))}
            disabled={selectedCount === 0 || isApplying}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
              backgroundColor: selectedCount === 0 || isApplying ? '#cbd5e1' : '#2563eb',
              color: 'white', fontSize: '0.85rem', fontWeight: 600,
              cursor: selectedCount === 0 || isApplying ? 'not-allowed' : 'pointer',
            }}
          >
            {isApplying ? '⏳ Applying...' : `Apply ${selectedCount} Field${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function pillButtonStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    padding: '0.3rem 0.6rem', borderRadius: '999px', border: `1px solid ${border}`,
    backgroundColor: bg, color, fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
  }
}
