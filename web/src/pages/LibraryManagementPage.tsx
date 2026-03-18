import { useState, useEffect, useCallback } from 'react'
import { useHousehold } from '../context/HouseholdContext'
import { useLibrary } from '../context/LibraryContext'
import {
  getLibraries,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  getLibraryMembers,
  addLibraryMember,
  updateLibraryMemberRole,
  removeLibraryMember,
  LibrarySummary,
  LibraryMemberDetail,
} from '../api/backend'

// ─── Sub-components ─────────────────────────────────────────────────────────

function LibraryCard({
  library,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  library: LibrarySummary
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '1rem',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eff6ff' : 'white',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            {library.name}
            {library.isDefault && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>
                (default)
              </span>
            )}
          </h3>
          {library.description && (
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              {library.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          {!library.isDefault && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid #fca5a5',
                borderRadius: 4,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LibraryManagementPage() {
  const { selectedHousehold, canEdit } = useHousehold()
  const { refreshLibraries } = useLibrary()

  // Library list
  const [libraries, setLibraries] = useState<LibrarySummary[]>([])
  const [selectedLibId, setSelectedLibId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Create/edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')

  // Members
  const [members, setMembers] = useState<LibraryMemberDetail[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('Member')
  const [memberError, setMemberError] = useState<string | null>(null)

  const householdId = selectedHousehold?.id

  // Load libraries
  const loadLibraries = useCallback(async () => {
    if (!householdId) return
    setIsLoading(true)
    try {
      const data = await getLibraries(householdId)
      setLibraries(data)
      if (data.length > 0 && !selectedLibId) {
        setSelectedLibId(data.find(l => l.isDefault)?.id ?? data[0].id)
      }
    } catch (err) {
      console.error('Failed to load libraries:', err)
    } finally {
      setIsLoading(false)
    }
  }, [householdId])

  useEffect(() => { loadLibraries() }, [loadLibraries])

  // Load members when library selected
  const loadMembers = useCallback(async () => {
    if (!selectedLibId) return
    setMembersLoading(true)
    try {
      const data = await getLibraryMembers(selectedLibId)
      setMembers(data)
    } catch (err) {
      console.error('Failed to load members:', err)
    } finally {
      setMembersLoading(false)
    }
  }, [selectedLibId])

  useEffect(() => { loadMembers() }, [loadMembers])

  // Handlers
  async function handleSaveLibrary() {
    if (!householdId || !formName.trim()) return
    try {
      if (editingId) {
        await updateLibrary(editingId, formName.trim(), formDesc.trim() || undefined)
      } else {
        await createLibrary(householdId, formName.trim(), formDesc.trim() || undefined)
      }
      setShowForm(false)
      setEditingId(null)
      setFormName('')
      setFormDesc('')
      await loadLibraries()
      await refreshLibraries()
    } catch (err) {
      console.error('Failed to save library:', err)
    }
  }

  async function handleDeleteLibrary(libId: string) {
    if (!confirm('Delete this library? All items in it will be removed.')) return
    try {
      await deleteLibrary(libId)
      if (selectedLibId === libId) setSelectedLibId(null)
      await loadLibraries()
      await refreshLibraries()
    } catch (err: any) {
      alert(err.message || 'Failed to delete library')
    }
  }

  function handleEditLibrary(lib: LibrarySummary) {
    setEditingId(lib.id)
    setFormName(lib.name)
    setFormDesc(lib.description ?? '')
    setShowForm(true)
  }

  async function handleAddMember() {
    if (!selectedLibId || !newMemberEmail.trim()) return
    setMemberError(null)
    try {
      await addLibraryMember(selectedLibId, newMemberEmail.trim(), newMemberRole)
      setNewMemberEmail('')
      setNewMemberRole('Member')
      await loadMembers()
    } catch (err: any) {
      setMemberError(err.message || 'Failed to add member')
    }
  }

  async function handleChangeRole(accountId: string, role: string) {
    if (!selectedLibId) return
    try {
      await updateLibraryMemberRole(selectedLibId, accountId, role)
      await loadMembers()
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  async function handleRemoveMember(accountId: string) {
    if (!selectedLibId) return
    if (!confirm('Remove this member from the library?')) return
    try {
      await removeLibraryMember(selectedLibId, accountId)
      await loadMembers()
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  if (!householdId) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Select a household first</div>
  }

  const selectedLib = libraries.find(l => l.id === selectedLibId)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Libraries</h1>
        {canEdit && (
          <button
            onClick={() => { setEditingId(null); setFormName(''); setFormDesc(''); setShowForm(true) }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + New Library
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: '#f8fafc',
        }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>{editingId ? 'Edit Library' : 'Create Library'}</h3>
          <input
            type="text"
            placeholder="Library name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSaveLibrary} style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}>
              Save
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Library List */}
      {isLoading ? (
        <p style={{ color: '#64748b' }}>Loading libraries...</p>
      ) : libraries.length === 0 ? (
        <p style={{ color: '#64748b' }}>No libraries yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {libraries.map((lib) => (
            <LibraryCard
              key={lib.id}
              library={lib}
              isSelected={lib.id === selectedLibId}
              onSelect={() => setSelectedLibId(lib.id)}
              onEdit={() => handleEditLibrary(lib)}
              onDelete={() => handleDeleteLibrary(lib.id)}
            />
          ))}
        </div>
      )}

      {/* Members Section */}
      {selectedLib && (
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
            Members of "{selectedLib.name}"
          </h2>

          {membersLoading ? (
            <p style={{ color: '#64748b' }}>Loading members...</p>
          ) : members.length === 0 ? (
            <p style={{ color: '#64748b' }}>No members.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>Role</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.accountId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{m.displayName}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>{m.email ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {canEdit ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.accountId, e.target.value)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderRadius: 4, border: '1px solid #cbd5e1' }}
                        >
                          <option value="Owner">Owner</option>
                          <option value="Member">Member</option>
                          <option value="ReadOnly">ReadOnly</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.9rem' }}>{m.role}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveMember(m.accountId)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.8rem',
                            border: '1px solid #fca5a5',
                            borderRadius: 4,
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add member */}
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Email address"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  fontSize: '0.9rem',
                  minWidth: 200,
                }}
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.9rem' }}
              >
                <option value="Owner">Owner</option>
                <option value="Member">Member</option>
                <option value="ReadOnly">ReadOnly</option>
              </select>
              <button
                onClick={handleAddMember}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Add Member
              </button>
              {memberError && (
                <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>{memberError}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
