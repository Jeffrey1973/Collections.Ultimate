import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getAllHouseholds, createHousehold } from '../api/backend'
import { useAuth } from './AuthContext'

interface Household {
  id: string
  name: string
  role: string
}

interface HouseholdContextType {
  households: Household[]
  selectedHousehold: Household | null
  isLoading: boolean
  error: string | null
  userRole: string
  canEdit: boolean
  selectHousehold: (household: Household) => void
  refreshHouseholds: () => Promise<void>
  createNewHousehold: (name: string) => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider')
  }
  return context
}

interface HouseholdProviderProps {
  children: ReactNode
}

export function HouseholdProvider({ children }: HouseholdProviderProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Load selected household from localStorage (only once when households load)
  useEffect(() => {
    console.log('🔍 Init effect running - households:', households.length, 'hasInit:', hasInitialized)
    if (households.length === 0) return // Wait for households to load
    if (hasInitialized) return // Already initialized, don't override user selections
    
    const savedId = localStorage.getItem('selectedHouseholdId')
    console.log('📂 Loading from localStorage:', savedId)
    if (savedId) {
      const household = households.find(h => h.id === savedId)
      if (household) {
        console.log('✅ Found saved household:', household.name)
        setSelectedHousehold(household)
        setHasInitialized(true)
        return
      }
    }
    
    // No saved selection or saved household not found, use first household
    console.log('🏁 Using first household:', households[0]?.name)
    setSelectedHousehold(households[0])
    setHasInitialized(true)
  }, [households, hasInitialized])

  // Save selected household to localStorage
  useEffect(() => {
    if (selectedHousehold) {
      console.log('💾 Saving to localStorage:', selectedHousehold.name, selectedHousehold.id)
      localStorage.setItem('selectedHouseholdId', selectedHousehold.id)
    }
  }, [selectedHousehold])

  // Load households once auth is ready and user is authenticated
  useEffect(() => {
    if (isAuthLoading) return // Still checking auth state
    if (!isAuthenticated) {
      // Not logged in — clear households and stop loading
      setHouseholds([])
      setSelectedHousehold(null)
      setIsLoading(false)
      return
    }
    loadHouseholds()
  }, [isAuthenticated, isAuthLoading])

  async function loadHouseholds() {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch households the current user belongs to
      const data = await getAllHouseholds()
      setHouseholds(data)
    } catch (err) {
      console.error('Failed to load households:', err)
      setError('Failed to load households. Is the backend API running?')
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshHouseholds() {
    await loadHouseholds()
  }

  async function createNewHousehold(name: string) {
    try {
      const newHousehold = await createHousehold(name)
      await loadHouseholds() // Refresh the list
      setSelectedHousehold(newHousehold)
    } catch (err) {
      console.error('Failed to create household:', err)
      throw err
    }
  }

  function selectHousehold(household: Household) {
    console.log('📍 selectHousehold called with:', household.name, household.id)
    setSelectedHousehold(household)
  }

  const userRole = selectedHousehold?.role || 'Member'
  const canEdit = userRole !== 'ReadOnly'

  return (
    <HouseholdContext.Provider
      value={{
        households,
        selectedHousehold,
        isLoading,
        error,
        userRole,
        canEdit,
        selectHousehold,
        refreshHouseholds,
        createNewHousehold,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}
