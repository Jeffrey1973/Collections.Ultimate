import { useState, useEffect, useCallback } from 'react'
import {
  getItemTimeline,
  getItemEventTypes,
  createItemEvent,
  deleteItemEvent,
  type ItemEventEntry,
  type ItemEventType,
} from '../api/backend'

interface ItemTimelineProps {
  itemId: string
}

export default function ItemTimeline({ itemId }: ItemTimelineProps) {
  const [events, setEvents] = useState<ItemEventEntry[]>([])
  const [eventTypes, setEventTypes] = useState<ItemEventType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add-event form state
  const [newEventTypeId, setNewEventTypeId] = useState<number>(0)
  const [newNotes, setNewNotes] = useState('')
  const [newDate, setNewDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadTimeline = useCallback(async () => {
    try {
      setError(null)
      const data = await getItemTimeline(itemId)
      setEvents(data)
    } catch (err) {
      console.error('Failed to load timeline:', err)
      setError('Failed to load event history')
    } finally {
      setIsLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    loadTimeline()
    getItemEventTypes().then(setEventTypes).catch(console.error)
  }, [loadTimeline])

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventTypeId) return

    setIsSubmitting(true)
    try {
      await createItemEvent(itemId, {
        eventTypeId: newEventTypeId,
        occurredUtc: newDate ? new Date(newDate).toISOString() : undefined,
        notes: newNotes || undefined,
      })
      await loadTimeline()
      setShowAddForm(false)
      setNewEventTypeId(0)
      setNewNotes('')
      setNewDate('')
    } catch (err) {
      console.error('Failed to add event:', err)
      setError('Failed to add event')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return
    try {
      await deleteItemEvent(itemId, eventId)
      setEvents(prev => prev.filter(ev => ev.id !== eventId))
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return <div style={{ padding: '1rem', color: '#64748b' }}>Loading history...</div>
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
          Event History
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            background: showAddForm ? '#e2e8f0' : '#3b82f6',
            color: showAddForm ? '#475569' : '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Add Event Form */}
      {showAddForm && (
        <form onSubmit={handleAddEvent} style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              Event Type *
            </label>
            <select
              value={newEventTypeId}
              onChange={e => setNewEventTypeId(Number(e.target.value))}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
              }}
            >
              <option value={0}>Select an event type...</option>
              {eventTypes.map(t => (
                <option key={t.id} value={t.id}>
                  {t.icon ? `${t.icon} ` : ''}{t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              When (optional — defaults to now)
            </label>
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              Notes (optional)
            </label>
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="e.g. Lent to John, moved to bedroom shelf..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newEventTypeId}
            style={{
              alignSelf: 'flex-end',
              padding: '0.5rem 1.2rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              fontSize: '0.9rem',
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Event'}
          </button>
        </form>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <div style={{ padding: '1rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', fontSize: '0.9rem' }}>
          No events recorded yet. Add one to start tracking this book's history.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '2rem' }}>
          {/* Vertical timeline line */}
          <div style={{
            position: 'absolute',
            left: '0.6rem',
            top: '0.5rem',
            bottom: '0.5rem',
            width: '2px',
            background: '#e2e8f0',
          }} />

          {events.map((evt, index) => (
            <div
              key={evt.id}
              style={{
                position: 'relative',
                marginBottom: index === events.length - 1 ? 0 : '1rem',
                paddingBottom: index === events.length - 1 ? 0 : '0.5rem',
              }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: '-1.65rem',
                top: '0.3rem',
                width: '1.5rem',
                height: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                background: '#fff',
                border: '2px solid #e2e8f0',
                borderRadius: '50%',
                zIndex: 1,
              }}>
                {evt.eventTypeIcon || '•'}
              </div>

              {/* Event card */}
              <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                      {evt.eventTypeLabel}
                    </span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {formatDate(evt.occurredUtc)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    title="Delete this event"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    ✕
                  </button>
                </div>

                {evt.notes && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    {evt.notes}
                  </p>
                )}

                {evt.detailJson && (
                  <pre style={{
                    margin: '0.35rem 0 0',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                  }}>
                    {evt.detailJson}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
