import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { askMistral as askMistralAI } from '../services/mistral'
import { logSessionEvent } from '../services/firebase'

export default function QuestionButton({ documentText, documentLanguage = 'de', documentId = '', patientId = '', onQuestionAnswered }) {
  const { t } = useTranslation()
  const [questionText, setQuestionText] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const getSpeechLanguage = () => {
    return documentLanguage === 'de' ? 'de-DE' : 'en-US'
  }

  const speakText = async (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    window.speechSynthesis.cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = getSpeechLanguage()
      utterance.rate = 1
      utterance.pitch = 1

      utterance.onend = () => resolve()
      utterance.onerror = (event) => reject(new Error(event.error || 'SpeechSynthesis Fehler'))

      window.speechSynthesis.speak(utterance)
    })
  }

  const handleSubmit = async () => {
    const trimmedQuestion = questionText.trim()
    if (!trimmedQuestion) {
      setError('Bitte geben Sie eine Frage ein.')
      return
    }

    setError('')
    setIsProcessing(true)
    setLastQuestion(trimmedQuestion)
    setAiResponse('')

    try {
      const response = await askMistralAI(trimmedQuestion, documentText, documentLanguage)
      await logSessionEvent(patientId, documentId, trimmedQuestion, response)
      setAiResponse(response)
      await speakText(response)

      if (onQuestionAnswered) {
        onQuestionAnswered()
      }
    } catch (err) {
      console.error('❌ Fehler bei KI-Verarbeitung:', err)
      setError(`KI-Fehler: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="question-input" className="sr-only">
          Frage eingeben
        </label>
        <textarea
          id="question-input"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder={t('patientView.questionPlaceholder')}
          className="w-full border border-gray-300 rounded-lg p-4 text-lg leading-relaxed min-h-[120px] text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ fontSize: '20px' }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isProcessing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg text-lg min-h-[48px]"
      >
        {isProcessing ? t('patientView.sendingQuestion') : t('patientView.sendQuestion')}
      </button>

      {lastQuestion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Ihre Frage:</p>
          <p className="text-lg font-semibold text-gray-800">{lastQuestion}</p>
        </div>
      )}

      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm animate-pulse">
          🤖 KI antwortet...
        </div>
      )}

      {aiResponse && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Antwort:</p>
          <p className="text-lg font-semibold text-gray-800 leading-relaxed">{aiResponse}</p>
        </div>
      )}
    </div>
  )
}
