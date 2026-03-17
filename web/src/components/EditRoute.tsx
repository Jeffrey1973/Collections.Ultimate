import { Navigate } from 'react-router-dom'
import { useHousehold } from '../context/HouseholdContext'

/**
 * Route guard that redirects ReadOnly users to the library page.
 * Wrap any route element that requires write access.
 */
export default function EditRoute({ children }: { children: React.ReactNode }) {
  const { canEdit, isLoading } = useHousehold()

  if (isLoading) return null

  if (!canEdit) {
    return <Navigate to="/library" replace />
  }

  return <>{children}</>
}
