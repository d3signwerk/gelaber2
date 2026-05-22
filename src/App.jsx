import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthChange } from './services/firebase'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import PatientView from './pages/PatientView'

/**
 * Haupt-App-Komponente
 * Verwaltet das Routing und die Authentifizierung
 */
export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentDocument, setCurrentDocument] = useState(null)

  /**
   * Authentifizierungsstatus überwachen
   */
  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  /**
   * Dokumenten-Sitzung starten
   */
  const handleStartDocumentSession = (document) => {
    setCurrentDocument(document)
  }

  /**
   * Dokumenten-Sitzung beenden
   */
  const handleEndDocumentSession = () => {
    setCurrentDocument(null)
  }

  // Loading-State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-600">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-xl font-semibold">gelaber2</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        {/* Login-Seite */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* Admin-Dashboard */}
        <Route
          path="/admin"
          element={
            user ? (
              currentDocument ? (
                <PatientView
                  document={currentDocument}
                  patientId={currentDocument?.patientId}
                  onSessionEnd={handleEndDocumentSession}
                />
              ) : (
                <AdminDashboard onStartDocumentSession={handleStartDocumentSession} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={user ? '/admin' : '/login'} replace />}
        />

        {/* 404 - Wildcard */}
        <Route
          path="*"
          element={<Navigate to={user ? '/admin' : '/login'} replace />}
        />
      </Routes>
    </Router>
  )
}
