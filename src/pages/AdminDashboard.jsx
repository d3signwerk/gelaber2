import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { logoutAdmin, onAuthChange, getCurrentUser, getPatientByCustomId, createPatient } from '../services/firebase'
import DocumentUpload from '../components/DocumentUpload'

export default function AdminDashboard({ onStartDocumentSession }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [documents, setDocuments] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  const [patientIdInput, setPatientIdInput] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientFound, setPatientFound] = useState(null)
  const [newPatientName, setNewPatientName] = useState('')
  const [patientLoading, setPatientLoading] = useState(false)

  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setCurrentUser(user)
    })
    try {
      const u = getCurrentUser()
      if (u) setCurrentUser(u)
    } catch (e) {
      // ignore
    }
    return () => unsub()
  }, [])

  const handleLogout = async () => {
    try {
      await logoutAdmin()
      navigate('/login')
    } catch (err) {
      console.error('Logout-Fehler:', err)
    }
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de'
    i18n.changeLanguage(newLang)
  }

  const handlePatientIdChange = (e) => {
    setPatientIdInput(e.target.value)
    setPatientFound(null)
    setPatientName('')
    setNewPatientName('')
    setSessionError('')
  }

  const handleSearchPatient = async () => {
    const id = patientIdInput.trim()
    if (!id) {
      setSessionError('Bitte Patienten-ID eingeben')
      return
    }
    setSessionError('')
    setPatientLoading(true)
    try {
      const patient = await getPatientByCustomId(id)
      if (patient) {
        setPatientFound(true)
        setPatientName(patient.name)
      } else {
        setPatientFound(false)
        setPatientName('')
      }
    } catch (err) {
      setSessionError('Fehler bei der Patientensuche')
    } finally {
      setPatientLoading(false)
    }
  }

  const handleCreatePatient = async () => {
    const id = patientIdInput.trim()
    const name = newPatientName.trim()
    if (!name) {
      setSessionError('Bitte Namen eingeben')
      return
    }
    setSessionError('')
    setPatientLoading(true)
    try {
      await createPatient(id, name)
      setPatientFound(true)
      setPatientName(name)
      setNewPatientName('')
    } catch (err) {
      setSessionError('Fehler beim Anlegen des Patienten')
    } finally {
      setPatientLoading(false)
    }
  }

  const handleStartSession = () => {
    const selectedDoc = documents.find((d) => d.id === selectedDocumentId)
    if (!selectedDoc) return

    const textForLanguage = selectedLanguage === 'de'
      ? (selectedDoc.extractedTextDe || selectedDoc.extractedText)
      : (selectedDoc.extractedTextEn || selectedDoc.extractedText)

    onStartDocumentSession?.({
      ...selectedDoc,
      extractedText: textForLanguage,
      language: selectedLanguage,
      patientId: patientIdInput.trim()
    })
  }

  const canStartSession = patientFound === true && !!selectedDocumentId

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">gelaber2</h1>
            <p className="text-gray-600 text-sm">{t('dashboard.title')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleLanguage}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-4 rounded-lg transition"
            >
              {i18n.language === 'de' ? '🇬🇧 EN' : '🇩🇪 DE'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {t('navigation.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Bereich A: Dokumente */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('documents.title')}</h2>
          <DocumentUpload onDocumentsChange={setDocuments} />
        </div>

        {/* Bereich B: Sitzung starten */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Sitzung starten</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">

            {/* Patienten-ID Suche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Patienten-ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={patientIdInput}
                  onChange={handlePatientIdChange}
                  placeholder="z.B. PAT-001"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                />
                <button
                  onClick={handleSearchPatient}
                  disabled={patientLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {patientLoading ? '...' : 'Suchen'}
                </button>
              </div>
            </div>

            {/* Ergebnis: gefunden */}
            {patientFound === true && (
              <p className="text-green-700 font-medium">Patient: {patientName}</p>
            )}

            {/* Ergebnis: nicht gefunden */}
            {patientFound === false && (
              <div className="space-y-3 border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-red-700 font-medium">Patient nicht gefunden</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name des Patienten</label>
                  <input
                    type="text"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Vor- und Nachname"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePatient()}
                  />
                </div>
                <button
                  onClick={handleCreatePatient}
                  disabled={patientLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {patientLoading ? '...' : 'Anlegen'}
                </button>
              </div>
            )}

            {/* Dokument auswählen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dokument auswählen</label>
              <select
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Bitte auswählen --</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sprache auswählen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sprache</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>

            {sessionError && (
              <p className="text-red-600 text-sm">{sessionError}</p>
            )}

            <button
              onClick={handleStartSession}
              disabled={!canStartSession}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Sitzung starten
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
