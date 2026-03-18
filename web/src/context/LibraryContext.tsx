import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getLibraries, createLibrary as apiCreateLibrary, LibrarySummary } from '../api/backend'
import { useHousehold } from './HouseholdContext'

interface LibraryContextType {
  libraries: LibrarySummary[]
  selectedLibrary: LibrarySummary | null
  isLoading: boolean
  /** Select a specific library */
  selectLibrary: (library: LibrarySummary) => void
  /** Reload the library list for the current household */
  refreshLibraries: () => Promise<void>
  /** Create a new library in the current household */
  createNewLibrary: (name: string, description?: string) => Promise<LibrarySummary>
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined)

export function useLibrary() {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error('useLibrary must be used within LibraryProvider')
  }
  return context
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { selectedHousehold } = useHousehold()
  const [libraries, setLibraries] = useState<LibrarySummary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<LibrarySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load libraries when household changes
  useEffect(() => {
    if (!selectedHousehold) {
      setLibraries([])
      setSelectedLibrary(null)
      return
    }
    loadLibraries(selectedHousehold.id)
  }, [selectedHousehold?.id])

  async function loadLibraries(householdId: string) {
    setIsLoading(true)
    try {
      const data = await getLibraries(householdId)
      setLibraries(data)

      // Restore from localStorage or pick default
      const savedId = localStorage.getItem(`selectedLibraryId_${householdId}`)
      const saved = savedId ? data.find(l => l.id === savedId) : null
      const defaultLib = data.find(l => l.isDefault) ?? data[0] ?? null
      setSelectedLibrary(saved ?? defaultLib)
    } catch (err) {
      console.error('Failed to load libraries:', err)
      setLibraries([])
      setSelectedLibrary(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Persist selection
  useEffect(() => {
    if (selectedLibrary && selectedHousehold) {
      localStorage.setItem(`selectedLibraryId_${selectedHousehold.id}`, selectedLibrary.id)
    }
  }, [selectedLibrary, selectedHousehold])

  const selectLibrary = useCallback((library: LibrarySummary) => {
    setSelectedLibrary(library)
  }, [])

  const refreshLibraries = useCallback(async () => {
    if (selectedHousehold) {
      await loadLibraries(selectedHousehold.id)
    }
  }, [selectedHousehold?.id])

  const createNewLibrary = useCallback(async (name: string, description?: string) => {
    if (!selectedHousehold) throw new Error('No household selected')
    const lib = await apiCreateLibrary(selectedHousehold.id, name, description)
    await loadLibraries(selectedHousehold.id)
    setSelectedLibrary(lib)
    return lib
  }, [selectedHousehold?.id])

  return (
    <LibraryContext.Provider
      value={{
        libraries,
        selectedLibrary,
        isLoading,
        selectLibrary,
        refreshLibraries,
        createNewLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  )
}
