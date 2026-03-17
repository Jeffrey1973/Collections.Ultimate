import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
import EditRoute from './components/EditRoute.tsx'
import LoginPage from './pages/LoginPage.tsx'
import HomePage from './pages/HomePage.tsx'
import LibraryPage from './pages/LibraryPage.tsx'
import AddBookPage from './pages/AddBookPage.tsx'
import ApiTestPage from './pages/ApiTestPage.tsx'
import BookDetailPage from './pages/BookDetailPage.tsx'
import BookEditPage from './pages/BookEditPage.tsx'
import HouseholdManagementPage from './pages/HouseholdManagementPage.tsx'
import ImportBooksPage from './pages/ImportBooksPage.tsx'
import DuplicateReviewPage from './pages/DuplicateReviewPage.tsx'
import BatchEnrichmentPage from './pages/BatchEnrichmentPage.tsx'
import { HouseholdProvider } from './context/HouseholdContext.tsx'
import { useAuth } from './context/AuthContext.tsx'
import CompleteProfileModal from './components/CompleteProfileModal.tsx'

function AppContent() {
  const { needsProfileCompletion, updateUserProfile } = useAuth()

  return (
    <>
      {needsProfileCompletion && (
        <CompleteProfileModal
          onComplete={(firstName, lastName, displayName) => {
            updateUserProfile(firstName, lastName, displayName)
          }}
        />
      )}
      <BrowserRouter>
        <Routes>
          {/* Public route — login page (no Layout chrome) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — require authentication when Auth0 is configured */}
          <Route path="*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/book/:id" element={<BookDetailPage />} />
                  <Route path="/book/:id/edit" element={<EditRoute><BookEditPage /></EditRoute>} />
                  <Route path="/add-book" element={<EditRoute><AddBookPage /></EditRoute>} />
                  <Route path="/households" element={<HouseholdManagementPage />} />
                  <Route path="/import" element={<EditRoute><ImportBooksPage /></EditRoute>} />
                  <Route path="/duplicates" element={<EditRoute><DuplicateReviewPage /></EditRoute>} />
                  <Route path="/enrich" element={<EditRoute><BatchEnrichmentPage /></EditRoute>} />
                  <Route path="/api-test" element={<ApiTestPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </>
  )
}

function App() {
  return (
    <HouseholdProvider>
      <AppContent />
    </HouseholdProvider>
  )
}

export default App
