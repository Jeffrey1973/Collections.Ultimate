import { useState, useEffect, useCallback } from 'react'
import { useHousehold } from '../context/HouseholdContext'
import { authFetch } from '../api/backend'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShelfLocation {
  id: string
  householdId: string
  name: string
  description: string
  locationType: 'room' | 'shelf' | 'cabinet' | 'box' | 'other'
  parentId: string | null // for nested locations (e.g. shelf inside room)
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface DigitalLocation {
  id: string
  householdId: string
  name: string
  platform: string // e.g. "Kindle", "Google Play Books", "Audible", "PDF", "Calibre"
  url: string
  accountEmail: string
  notes: string
  createdAt: string
  updatedAt: string
}

interface HouseholdDetail {
  id: string
  name: string
  shelfLocations: ShelfLocation[]
  digitalLocations: DigitalLocation[]
}

interface HouseholdMember {
  accountId: string
  displayName: string
  email: string | null
  role: string
  joinedUtc: string
}

// ─── Stub API calls (replace with real endpoints later) ──────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5259'

async function getHouseholdDetail(householdId: string): Promise<HouseholdDetail> {
  // TODO: Replace with real API call: GET /api/households/{id}/details
  // For now, return household with empty locations — they'll be managed locally
  // until the API endpoints exist
  const storedData = localStorage.getItem(`household_detail_${householdId}`)
  if (storedData) {
    return JSON.parse(storedData)
  }
  return {
    id: householdId,
    name: '',
    shelfLocations: [],
    digitalLocations: [],
  }
}

function persistHouseholdDetail(detail: HouseholdDetail) {
  // TODO: Replace with real API calls. For now, persist to localStorage
  localStorage.setItem(`household_detail_${detail.id}`, JSON.stringify(detail))
}

async function apiDeleteHousehold(householdId: string): Promise<void> {
  // Try calling the real API first
  try {
    const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}`, {
      method: 'DELETE',
    })
    if (response.ok) return
    // If 404, it may not exist on the server — that's ok
    if (response.status === 404) return
  } catch {
    // API not available — just continue
  }
  localStorage.removeItem(`household_detail_${householdId}`)
}

async function apiUpdateHousehold(householdId: string, name: string): Promise<void> {
  try {
    const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (response.ok) return
  } catch {
    // API not available — changes will only be in context
  }
}

// ─── Member API calls ────────────────────────────────────────────────────────

async function apiListMembers(householdId: string): Promise<HouseholdMember[]> {
  const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}/members`)
  if (!response.ok) throw new Error('Failed to load members')
  return response.json()
}

async function apiAddMember(householdId: string, email: string, role: string): Promise<HouseholdMember> {
  const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || 'Failed to add member')
  }
  return response.json()
}

async function apiUpdateMemberRole(householdId: string, accountId: string, role: string): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}/members/${accountId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!response.ok) throw new Error('Failed to update role')
}

async function apiRemoveMember(householdId: string, accountId: string): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/api/households/${householdId}/members/${accountId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to remove member')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const LOCATION_TYPES: { value: ShelfLocation['locationType']; label: string; icon: string }[] = [
  { value: 'room', label: 'Room', icon: '🏠' },
  { value: 'shelf', label: 'Bookshelf', icon: '📚' },
  { value: 'cabinet', label: 'Cabinet', icon: '🗄️' },
  { value: 'box', label: 'Box / Bin', icon: '📦' },
  { value: 'other', label: 'Other', icon: '📍' },
]

const DIGITAL_PLATFORMS = [
  'Kindle',
  'Google Play Books',
  'Apple Books',
  'Audible',
  'Kobo',
  'Nook',
  'Calibre',
  'PDF / Local File',
  'Libby / OverDrive',
  'Hoopla',
  'Internet Archive',
  'Other',
]

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
  } as React.CSSProperties,
  tabs: {
    display: 'flex',
    gap: '0.25rem',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '0.75rem 1.25rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#3b82f6' : '#64748b',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    marginBottom: '-2px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'color 0.15s',
  } as React.CSSProperties),
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1e293b',
  } as React.CSSProperties,
  listCard: {
    background: 'white',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    transition: 'box-shadow 0.15s',
  } as React.CSSProperties,
  listCardIcon: {
    fontSize: '1.5rem',
    width: 40,
    textAlign: 'center' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  listCardBody: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  listCardName: {
    fontWeight: 600,
    color: '#1e293b',
    fontSize: '1rem',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  listCardMeta: {
    color: '#64748b',
    fontSize: '0.85rem',
    marginTop: 2,
  } as React.CSSProperties,
  listCardActions: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
  } as React.CSSProperties,
  iconBtn: (variant: 'edit' | 'delete' | 'add') => ({
    background: variant === 'delete' ? '#fee2e2' : variant === 'add' ? '#dbeafe' : '#f1f5f9',
    border: 'none',
    borderRadius: 6,
    padding: '0.4rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: variant === 'delete' ? '#dc2626' : variant === 'add' ? '#2563eb' : '#475569',
    fontWeight: 500,
    transition: 'background 0.15s',
  } as React.CSSProperties),
  formOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  formCard: {
    background: 'white',
    borderRadius: 12,
    padding: '2rem',
    width: '100%',
    maxWidth: 500,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  } as React.CSSProperties,
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '1.25rem',
    color: '#1e293b',
  } as React.CSSProperties,
  fieldGroup: {
    marginBottom: '1rem',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontWeight: 500,
    fontSize: '0.875rem',
    color: '#374151',
    marginBottom: '0.35rem',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: '0.95rem',
    background: 'white',
    cursor: 'pointer',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: '0.95rem',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
  } as React.CSSProperties,
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.5rem',
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '3rem 1rem',
    color: '#94a3b8',
  } as React.CSSProperties,
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  householdCard: (isSelected: boolean) => ({
    background: 'white',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  } as React.CSSProperties),
  badge: (color: string) => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 9999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: color,
    color: 'white',
    marginLeft: '0.5rem',
  } as React.CSSProperties),
  deleteConfirm: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '1rem',
    marginTop: '1rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
}

// ─── Modal Components ────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={styles.formOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.formCard}>
        {children}
      </div>
    </div>
  )
}

// ─── Household Form ──────────────────────────────────────────────────────────

function HouseholdForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string }
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')

  return (
    <Modal onClose={onCancel}>
      <div style={styles.formTitle}>{initial ? 'Edit Household' : 'New Household'}</div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Household Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main House, Vacation Cabin"
          autoFocus
        />
      </div>
      <div style={styles.formActions}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim())}
        >
          {initial ? 'Save Changes' : 'Create Household'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Shelf Location Form ────────────────────────────────────────────────────

function ShelfLocationForm({
  initial,
  parentOptions,
  onSave,
  onCancel,
}: {
  initial?: ShelfLocation
  parentOptions: ShelfLocation[]
  onSave: (data: Omit<ShelfLocation, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [locationType, setLocationType] = useState<ShelfLocation['locationType']>(initial?.locationType ?? 'shelf')
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null)
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  return (
    <Modal onClose={onCancel}>
      <div style={styles.formTitle}>{initial ? 'Edit Location' : 'New Physical Location'}</div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Location Name *</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living Room Bookshelf, Top Shelf"
          autoFocus
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Type</label>
        <select
          style={styles.select}
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as ShelfLocation['locationType'])}
        >
          {LOCATION_TYPES.map((lt) => (
            <option key={lt.value} value={lt.value}>
              {lt.icon} {lt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Inside Of (optional)</label>
        <select
          style={styles.select}
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value || null)}
        >
          <option value="">— None (top level) —</option>
          {parentOptions
            .filter((p) => p.id !== initial?.id) // can't be inside itself
            .map((p) => (
              <option key={p.id} value={p.id}>
                {LOCATION_TYPES.find((lt) => lt.value === p.locationType)?.icon} {p.name}
              </option>
            ))}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <textarea
          style={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any notes about this location..."
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Sort Order</label>
        <input
          style={styles.input}
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
        />
      </div>

      <div style={styles.formActions}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              description,
              locationType,
              parentId,
              sortOrder,
            })
          }
        >
          {initial ? 'Save Changes' : 'Add Location'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Digital Location Form ───────────────────────────────────────────────────

function DigitalLocationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: DigitalLocation
  onSave: (data: Omit<DigitalLocation, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [platform, setPlatform] = useState(initial?.platform ?? 'Kindle')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [accountEmail, setAccountEmail] = useState(initial?.accountEmail ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <Modal onClose={onCancel}>
      <div style={styles.formTitle}>{initial ? 'Edit Digital Location' : 'New Digital Location'}</div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Name *</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dad's Kindle Library, Family Audible"
          autoFocus
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Platform</label>
        <select
          style={styles.select}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {DIGITAL_PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>URL / Link (optional)</label>
        <input
          style={styles.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://read.amazon.com/..."
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Account Email (optional)</label>
        <input
          style={styles.input}
          type="email"
          value={accountEmail}
          onChange={(e) => setAccountEmail(e.target.value)}
          placeholder="user@example.com"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Notes</label>
        <textarea
          style={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shared account credentials, subscription info, etc."
        />
      </div>

      <div style={styles.formActions}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              platform,
              url,
              accountEmail,
              notes,
            })
          }
        >
          {initial ? 'Save Changes' : 'Add Digital Location'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Delete Confirmation ─────────────────────────────────────────────────────

function DeleteConfirmation({
  itemName,
  onConfirm,
  onCancel,
}: {
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal onClose={onCancel}>
      <div style={styles.formTitle}>Confirm Delete</div>
      <p style={{ color: '#475569', lineHeight: 1.6 }}>
        Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
      </p>
      <div style={styles.formActions}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn"
          style={{ background: '#dc2626', color: 'white' }}
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}

// ─── Add Member Form ─────────────────────────────────────────────────────────

function AddMemberForm({
  onSave,
  onCancel,
  error,
}: {
  onSave: (email: string, role: string) => void
  onCancel: () => void
  error: string | null
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Member')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    await onSave(email.trim(), role)
    setSubmitting(false)
  }

  return (
    <Modal onClose={onCancel}>
      <div style={styles.formTitle}>Invite Member</div>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Enter the email address of an existing account to add them to this household.
      </p>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '0.6rem 0.75rem',
          marginBottom: '1rem',
          color: '#dc2626',
          fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Email Address *</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          autoFocus
        />
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Role</label>
        <select
          style={styles.select}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="Owner">👑 Owner — Full control</option>
          <option value="Member">👤 Member — Add & edit books</option>
          <option value="ReadOnly">👁️ ReadOnly — Browse only</option>
        </select>
      </div>
      <div style={styles.formActions}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!email.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Inviting...' : 'Add Member'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────────

type ActiveTab = 'households' | 'shelves' | 'digital' | 'members'

export default function HouseholdManagementPage() {
  const {
    households,
    selectedHousehold,
    selectHousehold,
    refreshHouseholds,
    createNewHousehold,
  } = useHousehold()

  const [activeTab, setActiveTab] = useState<ActiveTab>('households')
  const [shelfLocations, setShelfLocations] = useState<ShelfLocation[]>([])
  const [digitalLocations, setDigitalLocations] = useState<DigitalLocation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modal state
  const [showHouseholdForm, setShowHouseholdForm] = useState(false)
  const [editingHousehold, setEditingHousehold] = useState<{ id: string; name: string } | null>(null)
  const [showShelfForm, setShowShelfForm] = useState(false)
  const [editingShelf, setEditingShelf] = useState<ShelfLocation | null>(null)
  const [showDigitalForm, setShowDigitalForm] = useState(false)
  const [editingDigital, setEditingDigital] = useState<DigitalLocation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'household' | 'shelf' | 'digital' | 'member'; id: string; name: string } | null>(null)

  // Members state
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)

  // Load location data for the selected household
  const loadLocations = useCallback(async () => {
    if (!selectedHousehold) return
    setIsLoading(true)
    try {
      const detail = await getHouseholdDetail(selectedHousehold.id)
      setShelfLocations(detail.shelfLocations)
      setDigitalLocations(detail.digitalLocations)
    } catch (err) {
      console.error('Failed to load household details:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedHousehold])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // Load members when household or tab changes
  const loadMembers = useCallback(async () => {
    if (!selectedHousehold) return
    setMembersLoading(true)
    setMemberError(null)
    try {
      const list = await apiListMembers(selectedHousehold.id)
      setMembers(list)
    } catch (err) {
      console.error('Failed to load members:', err)
      setMemberError('Failed to load members')
    } finally {
      setMembersLoading(false)
    }
  }, [selectedHousehold])

  useEffect(() => {
    if (activeTab === 'members') loadMembers()
  }, [activeTab, loadMembers])

  // ── Persist helper ──
  function saveLocations(shelves: ShelfLocation[], digital: DigitalLocation[]) {
    if (!selectedHousehold) return
    setShelfLocations(shelves)
    setDigitalLocations(digital)
    persistHouseholdDetail({
      id: selectedHousehold.id,
      name: selectedHousehold.name,
      shelfLocations: shelves,
      digitalLocations: digital,
    })
  }

  // ── Household CRUD ──
  async function handleCreateHousehold(name: string) {
    await createNewHousehold(name)
    setShowHouseholdForm(false)
  }

  async function handleEditHousehold(name: string) {
    if (!editingHousehold) return
    await apiUpdateHousehold(editingHousehold.id, name)
    await refreshHouseholds()
    setEditingHousehold(null)
  }

  async function handleDeleteHousehold() {
    if (!deleteTarget || deleteTarget.type !== 'household') return
    await apiDeleteHousehold(deleteTarget.id)
    await refreshHouseholds()
    setDeleteTarget(null)
  }

  // ── Shelf Location CRUD ──
  function handleSaveShelf(data: Omit<ShelfLocation, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) {
    if (!selectedHousehold) return
    const now = new Date().toISOString()

    if (editingShelf) {
      // Update
      const updated = shelfLocations.map((s) =>
        s.id === editingShelf.id
          ? { ...s, ...data, updatedAt: now }
          : s
      )
      saveLocations(updated, digitalLocations)
    } else {
      // Create
      const newShelf: ShelfLocation = {
        id: generateId(),
        householdId: selectedHousehold.id,
        ...data,
        createdAt: now,
        updatedAt: now,
      }
      saveLocations([...shelfLocations, newShelf], digitalLocations)
    }
    setShowShelfForm(false)
    setEditingShelf(null)
  }

  function handleDeleteShelf() {
    if (!deleteTarget || deleteTarget.type !== 'shelf') return
    // Also un-parent any children
    const updated = shelfLocations
      .filter((s) => s.id !== deleteTarget.id)
      .map((s) => (s.parentId === deleteTarget.id ? { ...s, parentId: null } : s))
    saveLocations(updated, digitalLocations)
    setDeleteTarget(null)
  }

  // ── Digital Location CRUD ──
  function handleSaveDigital(data: Omit<DigitalLocation, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) {
    if (!selectedHousehold) return
    const now = new Date().toISOString()

    if (editingDigital) {
      const updated = digitalLocations.map((d) =>
        d.id === editingDigital.id
          ? { ...d, ...data, updatedAt: now }
          : d
      )
      saveLocations(shelfLocations, updated)
    } else {
      const newDigital: DigitalLocation = {
        id: generateId(),
        householdId: selectedHousehold.id,
        ...data,
        createdAt: now,
        updatedAt: now,
      }
      saveLocations(shelfLocations, [...digitalLocations, newDigital])
    }
    setShowDigitalForm(false)
    setEditingDigital(null)
  }

  function handleDeleteDigital() {
    if (!deleteTarget || deleteTarget.type !== 'digital') return
    const updated = digitalLocations.filter((d) => d.id !== deleteTarget.id)
    saveLocations(shelfLocations, updated)
    setDeleteTarget(null)
  }

  // ── Member CRUD ──
  async function handleAddMember(email: string, role: string) {
    if (!selectedHousehold) return
    setMemberError(null)
    try {
      await apiAddMember(selectedHousehold.id, email, role)
      await loadMembers()
      setShowMemberForm(false)
    } catch (err: any) {
      setMemberError(err.message || 'Failed to add member')
    }
  }

  async function handleUpdateRole(accountId: string, role: string) {
    if (!selectedHousehold) return
    setMemberError(null)
    try {
      await apiUpdateMemberRole(selectedHousehold.id, accountId, role)
      setMembers((prev) => prev.map((m) => m.accountId === accountId ? { ...m, role } : m))
    } catch (err: any) {
      setMemberError(err.message || 'Failed to update role')
    }
  }

  async function handleRemoveMember() {
    if (!selectedHousehold || !deleteTarget || deleteTarget.type !== 'member') return
    setMemberError(null)
    try {
      await apiRemoveMember(selectedHousehold.id, deleteTarget.id)
      setMembers((prev) => prev.filter((m) => m.accountId !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: any) {
      setMemberError(err.message || 'Failed to remove member')
      setDeleteTarget(null)
    }
  }

  // ── Build hierarchical shelf list ──
  function getShelfHierarchy(): (ShelfLocation & { depth: number })[] {
    const result: (ShelfLocation & { depth: number })[] = []
    const sorted = [...shelfLocations].sort((a, b) => a.sortOrder - b.sortOrder)

    function addChildren(parentId: string | null, depth: number) {
      sorted
        .filter((s) => s.parentId === parentId)
        .forEach((s) => {
          result.push({ ...s, depth })
          addChildren(s.id, depth + 1)
        })
    }
    addChildren(null, 0)

    // Add any orphans that weren't found in the tree
    sorted.forEach((s) => {
      if (!result.find((r) => r.id === s.id)) {
        result.push({ ...s, depth: 0 })
      }
    })

    return result
  }

  function getLocationIcon(type: ShelfLocation['locationType']): string {
    return LOCATION_TYPES.find((lt) => lt.value === type)?.icon ?? '📍'
  }

  function getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      Kindle: '📱',
      'Google Play Books': '📖',
      'Apple Books': '🍎',
      Audible: '🎧',
      Kobo: '📕',
      Nook: '📗',
      Calibre: '💻',
      'PDF / Local File': '📄',
      'Libby / OverDrive': '🏛️',
      Hoopla: '🎭',
      'Internet Archive': '🌐',
    }
    return map[platform] ?? '💾'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div className="page-header">
        <h1 className="page-title">Household Management</h1>
        <p className="page-subtitle">
          Manage your households, physical shelf locations, and digital book locations
        </p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === 'households')} onClick={() => setActiveTab('households')}>
          🏠 Households
        </button>
        <button style={styles.tab(activeTab === 'shelves')} onClick={() => setActiveTab('shelves')}>
          📚 Physical Locations
        </button>
        <button style={styles.tab(activeTab === 'digital')} onClick={() => setActiveTab('digital')}>
          💻 Digital Locations
        </button>
        <button style={styles.tab(activeTab === 'members')} onClick={() => setActiveTab('members')}>
          👤 Members
        </button>
      </div>

      {/* ─── Households Tab ───────────────────────────────────────────────── */}
      {activeTab === 'households' && (
        <div>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Your Households</span>
            <button className="btn btn-primary" onClick={() => setShowHouseholdForm(true)}>
              + New Household
            </button>
          </div>

          {households.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🏠</div>
              <p>No households yet. Create one to get started.</p>
            </div>
          ) : (
            households.map((h) => (
              <div
                key={h.id}
                style={styles.householdCard(selectedHousehold?.id === h.id)}
                onClick={() => selectHousehold(h)}
              >
                <div style={styles.listCardIcon}>🏠</div>
                <div style={styles.listCardBody}>
                  <div style={styles.listCardName}>
                    {h.name}
                    {selectedHousehold?.id === h.id && (
                      <span style={styles.badge('#3b82f6')}>Active</span>
                    )}
                  </div>
                  <div style={styles.listCardMeta}>
                    ID: {h.id.slice(0, 8)}...
                  </div>
                </div>
                <div style={styles.listCardActions}>
                  <button
                    style={styles.iconBtn('edit')}
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingHousehold({ id: h.id, name: h.name })
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    style={styles.iconBtn('delete')}
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget({ type: 'household', id: h.id, name: h.name })
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Physical Shelf Locations Tab ─────────────────────────────────── */}
      {activeTab === 'shelves' && (
        <div>
          {!selectedHousehold ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⚠️</div>
              <p>Select a household first from the Households tab</p>
            </div>
          ) : (
            <>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>
                  Physical Locations — {selectedHousehold.name}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingShelf(null)
                    setShowShelfForm(true)
                  }}
                >
                  + Add Location
                </button>
              </div>

              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Define where physical books live — rooms, shelves, cabinets, boxes. 
                Locations can be nested (e.g. a shelf inside a room).
              </p>

              {isLoading ? (
                <div className="loading">Loading locations...</div>
              ) : shelfLocations.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>📚</div>
                  <p>No physical locations defined yet.</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    Add locations like "Living Room", "Office Bookshelf", "Garage Box 3", etc.
                  </p>
                </div>
              ) : (
                getShelfHierarchy().map((shelf) => (
                  <div
                    key={shelf.id}
                    style={{
                      ...styles.listCard,
                      marginLeft: shelf.depth * 32,
                      borderLeft: shelf.depth > 0 ? '3px solid #e2e8f0' : 'none',
                    }}
                  >
                    <div style={styles.listCardIcon}>{getLocationIcon(shelf.locationType)}</div>
                    <div style={styles.listCardBody}>
                      <div style={styles.listCardName}>{shelf.name}</div>
                      <div style={styles.listCardMeta}>
                        {LOCATION_TYPES.find((lt) => lt.value === shelf.locationType)?.label}
                        {shelf.description && ` · ${shelf.description}`}
                        {shelf.parentId && (
                          <>
                            {' · inside '}
                            <em>{shelfLocations.find((s) => s.id === shelf.parentId)?.name ?? 'Unknown'}</em>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={styles.listCardActions}>
                      <button
                        style={styles.iconBtn('edit')}
                        onClick={() => {
                          setEditingShelf(shelf)
                          setShowShelfForm(true)
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        style={styles.iconBtn('delete')}
                        onClick={() => setDeleteTarget({ type: 'shelf', id: shelf.id, name: shelf.name })}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Digital Locations Tab ────────────────────────────────────────── */}
      {activeTab === 'digital' && (
        <div>
          {!selectedHousehold ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⚠️</div>
              <p>Select a household first from the Households tab</p>
            </div>
          ) : (
            <>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>
                  Digital Locations — {selectedHousehold.name}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingDigital(null)
                    setShowDigitalForm(true)
                  }}
                >
                  + Add Digital Location
                </button>
              </div>

              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Track where digital copies of books are stored — Kindle, Audible, Calibre, etc.
              </p>

              {isLoading ? (
                <div className="loading">Loading locations...</div>
              ) : digitalLocations.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>💻</div>
                  <p>No digital locations defined yet.</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    Add locations like "Mom's Kindle", "Family Audible Account", "Calibre on NAS", etc.
                  </p>
                </div>
              ) : (
                digitalLocations.map((dl) => (
                  <div key={dl.id} style={styles.listCard}>
                    <div style={styles.listCardIcon}>{getPlatformIcon(dl.platform)}</div>
                    <div style={styles.listCardBody}>
                      <div style={styles.listCardName}>{dl.name}</div>
                      <div style={styles.listCardMeta}>
                        {dl.platform}
                        {dl.accountEmail && ` · ${dl.accountEmail}`}
                        {dl.url && (
                          <>
                            {' · '}
                            <a
                              href={dl.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#3b82f6' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                            </a>
                          </>
                        )}
                        {dl.notes && ` · ${dl.notes}`}
                      </div>
                    </div>
                    <div style={styles.listCardActions}>
                      <button
                        style={styles.iconBtn('edit')}
                        onClick={() => {
                          setEditingDigital(dl)
                          setShowDigitalForm(true)
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        style={styles.iconBtn('delete')}
                        onClick={() => setDeleteTarget({ type: 'digital', id: dl.id, name: dl.name })}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Members Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div>
          {!selectedHousehold ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⚠️</div>
              <p>Select a household first from the Households tab</p>
            </div>
          ) : (
            <>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>
                  Members — {selectedHousehold.name}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setMemberError(null)
                    setShowMemberForm(true)
                  }}
                >
                  + Invite Member
                </button>
              </div>

              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Manage who has access to this household's library. Members can be assigned roles:
                <strong> Owner</strong> (full control), <strong>Member</strong> (add/edit books), or <strong>ReadOnly</strong> (browse only).
              </p>

              {memberError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  color: '#dc2626',
                  fontSize: '0.9rem',
                }}>
                  {memberError}
                </div>
              )}

              {membersLoading ? (
                <div className="loading">Loading members...</div>
              ) : members.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>👤</div>
                  <p>No members yet.</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    Invite people by their account email to give them access to this household.
                  </p>
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.accountId} style={styles.listCard}>
                    <div style={styles.listCardIcon}>
                      {member.role === 'Owner' ? '👑' : member.role === 'ReadOnly' ? '👁️' : '👤'}
                    </div>
                    <div style={styles.listCardBody}>
                      <div style={styles.listCardName}>
                        {member.displayName}
                        <span style={styles.badge(
                          member.role === 'Owner' ? '#f59e0b' :
                          member.role === 'ReadOnly' ? '#94a3b8' :
                          '#3b82f6'
                        )}>
                          {member.role}
                        </span>
                      </div>
                      <div style={styles.listCardMeta}>
                        {member.email ?? 'No email'}
                        {member.joinedUtc && ` · Joined ${new Date(member.joinedUtc).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div style={styles.listCardActions}>
                      <select
                        style={{
                          ...styles.select,
                          width: 'auto',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.8rem',
                        }}
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.accountId, e.target.value)}
                      >
                        <option value="Owner">Owner</option>
                        <option value="Member">Member</option>
                        <option value="ReadOnly">ReadOnly</option>
                      </select>
                      <button
                        style={styles.iconBtn('delete')}
                        title="Remove member"
                        onClick={() => setDeleteTarget({
                          type: 'member',
                          id: member.accountId,
                          name: member.displayName,
                        })}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────────────── */}

      {showHouseholdForm && (
        <HouseholdForm
          onSave={handleCreateHousehold}
          onCancel={() => setShowHouseholdForm(false)}
        />
      )}

      {editingHousehold && (
        <HouseholdForm
          initial={{ name: editingHousehold.name }}
          onSave={handleEditHousehold}
          onCancel={() => setEditingHousehold(null)}
        />
      )}

      {showShelfForm && (
        <ShelfLocationForm
          initial={editingShelf ?? undefined}
          parentOptions={shelfLocations}
          onSave={handleSaveShelf}
          onCancel={() => {
            setShowShelfForm(false)
            setEditingShelf(null)
          }}
        />
      )}

      {showDigitalForm && (
        <DigitalLocationForm
          initial={editingDigital ?? undefined}
          onSave={handleSaveDigital}
          onCancel={() => {
            setShowDigitalForm(false)
            setEditingDigital(null)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmation
          itemName={deleteTarget.name}
          onConfirm={() => {
            if (deleteTarget.type === 'household') handleDeleteHousehold()
            else if (deleteTarget.type === 'shelf') handleDeleteShelf()
            else if (deleteTarget.type === 'digital') handleDeleteDigital()
            else if (deleteTarget.type === 'member') handleRemoveMember()
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showMemberForm && (
        <AddMemberForm
          onSave={handleAddMember}
          onCancel={() => setShowMemberForm(false)}
          error={memberError}
        />
      )}
    </div>
  )
}
