import { Link } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'

export default function LibrarySelector() {
  const { libraries, selectedLibrary, selectLibrary, isLoading } = useLibrary()

  if (isLoading || libraries.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0',
    }}>
      <label htmlFor="library-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>
        Library:
      </label>
      <select
        id="library-select"
        value={selectedLibrary?.id || ''}
        onChange={(e) => {
          const lib = libraries.find(l => l.id === e.target.value)
          if (lib) selectLibrary(lib)
        }}
        style={{
          padding: '0.4rem 0.6rem',
          fontSize: '0.85rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        {libraries.map((lib) => (
          <option key={lib.id} value={lib.id}>
            {lib.name}{lib.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
      <Link
        to="/libraries"
        style={{
          fontSize: '0.75rem',
          color: '#3b82f6',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
        title="Manage libraries"
      >
        Manage
      </Link>
    </div>
  )
}
