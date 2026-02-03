import { useHousehold } from '../context/HouseholdContext'

export default function HouseholdSelector() {
  const { households, selectedHousehold, selectHousehold, isLoading } = useHousehold()

  if (isLoading) {
    return (
      <div style={{ padding: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
        Loading households...
      </div>
    )
  }

  if (households.length === 0) {
    return (
      <div style={{ padding: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
        No households found
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0',
    }}>
      <label htmlFor="household-select" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
        Library:
      </label>
      <select
        id="household-select"
        value={selectedHousehold?.id || ''}
        onChange={(e) => {
          console.log('🔄 Household selection changed to:', e.target.value)
          const household = households.find(h => h.id === e.target.value)
          console.log('🏠 Found household:', household)
          if (household) {
            selectHousehold(household)
            console.log('✅ Called selectHousehold')
          }
        }}
        style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.9rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        {households.map((household) => (
          <option key={household.id} value={household.id}>
            {household.name}
          </option>
        ))}
      </select>
    </div>
  )
}
