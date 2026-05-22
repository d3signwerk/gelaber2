import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import TextPlayer from '../components/TextPlayer'
import QuestionButton from '../components/QuestionButton'

/**
 * PatientView-Seite
 * Hauptoberfläche für Patienten im Kiosk-Modus
 * Optimiert für Tablet mit großen Buttons (48px+)
 */
export default function PatientView({ document: selectedDocument, patientId, onSessionEnd }) {
  const { t, i18n } = useTranslation()
  
  const [currentDoc, setCurrentDoc] = useState(selectedDocument)
  const [loading, setLoading] = useState(!selectedDocument)
  const [error, setError] = useState('')
  const [inactivityWarningTime, setInactivityWarningTime] = useState(null)
  
  const inactivityTimeoutMs = 30 * 60 * 1000 // 30 Minuten
  const warningTimeMs = 25 * 60 * 1000 // Warning nach 25 Minuten

  useEffect(() => {
    setCurrentDoc(selectedDocument)
    console.log('currentDoc.language:', selectedDocument?.language)
    if (!selectedDocument) {
      setError(t('patientView.noDocument'))
      setLoading(false)
      return
    }

    setLoading(false)
    setError('')

    if (selectedDocument.language && i18n.language !== selectedDocument.language) {
      i18n.changeLanguage(selectedDocument.language)
    }
  }, [selectedDocument, i18n, t])

  // Inaktivitäts-Timer
  useEffect(() => {
    let timeoutId
    let warningTimeoutId
    
    /**
     * Inaktivitäts-Timer zurücksetzen
     */
    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (warningTimeoutId) clearTimeout(warningTimeoutId)
      setInactivityWarningTime(null)
      
      warningTimeoutId = setTimeout(() => {
        setInactivityWarningTime(true)
      }, warningTimeMs)
      
      timeoutId = setTimeout(() => {
        handleSessionEnd()
      }, inactivityTimeoutMs)
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click']
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer)
    })
    resetInactivityTimer()

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer)
      })
      if (timeoutId) clearTimeout(timeoutId)
      if (warningTimeoutId) clearTimeout(warningTimeoutId)
    }
  }, [inactivityTimeoutMs, warningTimeMs])

  /**
   * Sitzung beenden und zum Admin-Dashboard zurück
   */
  const handleSessionEnd = useCallback(() => {
    if (onSessionEnd) {
      onSessionEnd()
    }
  }, [onSessionEnd])

  /**
   * Browser-Zurück-Button deaktivieren
   */
  useEffect(() => {
    const preventBackButton = (e) => {
      e.preventDefault()
      window.history.pushState(null, null, window.location.href)
    }

    window.history.pushState(null, null, window.location.href)
    window.addEventListener('popstate', preventBackButton)

    return () => {
      window.removeEventListener('popstate', preventBackButton)
    }
  }, [])

  if (loading) {
    return (
      <div className="fullscreen flex items-center justify-center bg-blue-600">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-xl font-semibold">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !currentDoc) {
    return (
      <div className="fullscreen flex items-center justify-center bg-red-600 p-4">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ {t('common.error')}</h1>
          <p className="text-xl text-gray-800 mb-6">{error || t('patientView.noDocument')}</p>
          <button
            onClick={handleSessionEnd}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg min-h-[48px] text-lg"
          >
            {t('navigation.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fullscreen bg-gradient-to-b from-blue-50 to-white overflow-auto">
      <div className="bg-blue-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">{t('patientView.documentTitle')}</p>
            <h1 className="text-3xl font-bold">{currentDoc.name}</h1>
            <div className="flex gap-4 mt-2">
              <span className="text-sm opacity-90">
                {t('patientView.language')}: <span className="font-semibold">
                  {currentDoc.language === 'de' ? 'Deutsch' :
               currentDoc.language === 'en' ? 'English' :
               currentDoc.language}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={handleSessionEnd}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition min-h-[48px] text-lg"
          >
            ✕ {t('patientView.stop')}
          </button>
        </div>
      </div>

      {inactivityWarningTime && (
        <div className="bg-yellow-500 text-white p-4 text-center font-semibold animate-pulse">
          ⏰ {t('patientView.inactivityWarning')}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">{t('patientView.play')}</h2>
          <TextPlayer
            text={currentDoc.extractedText}
            language={currentDoc.language}
            voiceId={currentDoc.voiceId}
            patientId={patientId}
            documentId={currentDoc.id}
          />
        </section>

        <div className="border-t-2 border-gray-300"></div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">{t('patientView.question')}</h2>
          <QuestionButton
            documentText={currentDoc.extractedText}
            documentLanguage={currentDoc.language}
            documentId={currentDoc.id}
            patientId={patientId}
          />
        </section>
      </div>

      <div className="bg-gray-100 border-t border-gray-300 p-4 text-center text-gray-600 text-sm mt-8">
        <p>gelaber2 - {t('dashboard.title')}</p>
      </div>
    </div>
  )
}
