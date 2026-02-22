import { useState } from 'react'
import { authFetch } from '../api/backend'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5259'

interface CompleteProfileModalProps {
  onComplete: (firstName: string, lastName: string, displayName: string) => void
}

export default function CompleteProfileModal({ onComplete }: CompleteProfileModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Both first and last name are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await authFetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      })

      if (response.ok) {
        const data = await response.json()
        onComplete(data.firstName, data.lastName, data.displayName)
      } else {
        setError('Failed to save profile. Please try again.')
      }
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.icon}>👋</div>
        <h2 style={styles.title}>Welcome! Complete Your Profile</h2>
        <p style={styles.subtitle}>
          Please enter your name so other household members can identify you.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={styles.input}
              placeholder="Enter your first name"
              autoFocus
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={styles.input}
              placeholder="Enter your last name"
              required
            />
          </div>

          <button type="submit" style={styles.button} disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '2.5rem',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  title: {
    margin: '0 0 0.5rem',
    fontSize: '1.5rem',
    color: '#1e293b',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    color: '#64748b',
    fontSize: '0.9rem',
    lineHeight: '1.4',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  field: {
    textAlign: 'left' as const,
  },
  label: {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
