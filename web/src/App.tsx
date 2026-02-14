import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
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

function App() {
  return (
    <HouseholdProvider>
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
                  <Route path="/book/:id/edit" element={<BookEditPage />} />
                  <Route path="/add-book" element={<AddBookPage />} />
                  <Route path="/households" element={<HouseholdManagementPage />} />
                  <Route path="/import" element={<ImportBooksPage />} />
                  <Route path="/duplicates" element={<DuplicateReviewPage />} />
                  <Route path="/enrich" element={<BatchEnrichmentPage />} />
                  <Route path="/api-test" element={<ApiTestPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </HouseholdProvider>
  )
}

export default App
