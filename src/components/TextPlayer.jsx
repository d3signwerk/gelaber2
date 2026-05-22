import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { askMistral } from '../services/mistral'
import { logSessionEvent } from '../services/firebase'

const getVoices = () => {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      resolve(voices)
      return
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices())
    }
  })
}

export default function TextPlayer({ text, language = 'de', patientId, documentId }) {
  const { t } = useTranslation()

  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [highlightedSentenceIndex, setHighlightedSentenceIndex] = useState(-1)
  const [currentSentence, setCurrentSentence] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [error, setError] = useState('')

  const currentIndex = useRef(0)
  const isMounted = useRef(true)
  const isPausedRef = useRef(false)

  const sentences = (text?.trim() ? text.split(/(?<=[.!?])\s+/) : [''])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      window.speechSynthesis.cancel()
    }
  }, [])

  const getSpeechLanguage = () => {
    switch (language) {
      case 'de': return 'de-DE'
      case 'en': return 'en-US'
      default: return 'de-DE'
    }
  }

  const speakText = async (speechText, lang) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('SpeechSynthesis nicht verfügbar')
    }

    console.log('speakText aufgerufen:', speechText.substring(0, 30))
    window.speechSynthesis.cancel()
    await new Promise((r) => setTimeout(r, 150))

    const voices = await getVoices()
    console.log('Stimmen geladen:', voices.length)
    const voice =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ||
      null
    console.log('Gewählte Stimme:', voice?.name, voice?.lang)

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(speechText)
      utterance.lang = lang
      if (voice) utterance.voice = voice

      let finished = false

      utterance.onstart = () => console.log('ONSTART gefeuert')

      utterance.onend = () => {
        if (finished) return
        finished = true
        console.log('ONEND gefeuert')
        resolve()
      }

      utterance.onerror = (event) => {
        if (finished) return
        finished = true
        console.log('ONERROR:', event.error)
        if (event.error === 'interrupted' || event.error === 'cancelled') {
          resolve()
          return
        }
        reject(new Error(event.error || 'SpeechSynthesis Fehler'))
      }

      window.speechSynthesis.speak(utterance)
      console.log('speak() aufgerufen')
    })
  }

  const playFromIndex = async (index) => {
    const startIndex = index >= 0 && index < sentences.length ? index : 0
    currentIndex.current = startIndex
    setError('')
    setIsPaused(false)
    isPausedRef.current = false
    setIsPlaying(true)

    const lang = getSpeechLanguage()
    console.log('playFromIndex start, sentences:', sentences.length, 'lang:', lang)
    console.log('vor while - isMounted:', isMounted.current, 'isPausedRef:', isPausedRef.current)

    while (currentIndex.current < sentences.length && isMounted.current && !isPausedRef.current) {
      console.log('while iteration:', currentIndex.current)
      const sentence = sentences[currentIndex.current]
      setHighlightedSentenceIndex(currentIndex.current)
      setCurrentSentence(sentence)

      try {
        await speakText(sentence, lang)
      } catch (err) {
        console.error('TTS-Fehler:', err)
        setError(t('patientView.ttsError'))
        setIsPlaying(false)
        setIsPaused(false)
        setHighlightedSentenceIndex(-1)
        setCurrentSentence('')
        return
      }

      await new Promise(r => setTimeout(r, 400))

      if (!isMounted.current || isPausedRef.current) {
        break
      }

      currentIndex.current += 1
    }

    if (!isMounted.current) return

    if (isPausedRef.current) {
      setIsPlaying(false)
      return
    }

    if (currentIndex.current >= sentences.length) {
      setIsPlaying(false)
      setHighlightedSentenceIndex(-1)
      setCurrentSentence('')
    }
  }

  const handlePlay = () => {
    if (isPlaying) return
    currentIndex.current = 0
    playFromIndex(0)
  }

  const handlePause = () => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    setIsPaused(true)
    isPausedRef.current = true
  }

  const handleResume = () => {
    setIsPaused(false)
    isPausedRef.current = false
    playFromIndex(currentIndex.current)
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
    currentIndex.current = 0
    setIsPlaying(false)
    setIsPaused(false)
    isPausedRef.current = false
    setHighlightedSentenceIndex(-1)
    setCurrentSentence('')
    setQuestionText('')
    setError('')
  }

  const handleSendQuestion = async () => {
    if (!questionText.trim()) {
      setError('Bitte geben Sie eine Frage ein.')
      return
    }

    setError('')
    setIsAsking(true)
    setIsPlaying(false)
    setIsPaused(true)
    isPausedRef.current = true

    try {
      const mistralLanguage = language === 'de' ? 'de' : 'en'
      const answer = await askMistral(questionText.trim(), text, mistralLanguage)
      await logSessionEvent(patientId, documentId, questionText.trim(), answer)
      await speakText(answer, getSpeechLanguage())
    } catch (err) {
      console.error('Fehler beim Senden der Frage:', err)
      setError('Fehler beim Senden der Frage. Bitte versuchen Sie es erneut.')
    } finally {
      setIsAsking(false)
      setQuestionText('')
      setIsPaused(true)
      isPausedRef.current = true
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 justify-center flex-wrap">
        {!isPlaying && !isPaused ? (
          <button
            onClick={handlePlay}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg transition min-h-[48px] min-w-[48px] text-lg"
          >
            ▶ {t('patientView.play')}
          </button>
        ) : isPlaying ? (
          <>
            <button
              onClick={handlePause}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-4 px-8 rounded-lg transition min-h-[48px] min-w-[48px] text-lg"
            >
              ⏸ {t('patientView.pause') || 'Pause'}
            </button>
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-lg transition min-h-[48px] min-w-[48px] text-lg"
            >
              ◼ {t('patientView.stop')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleResume}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg transition min-h-[48px] min-w-[48px] text-lg"
            >
              ▶ {t('patientView.continue') || 'Weiter'}
            </button>
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-lg transition min-h-[48px] min-w-[48px] text-lg"
            >
              ◼ {t('patientView.stop')}
            </button>
          </>
        )}
      </div>

      {isPlaying && currentSentence && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-center text-gray-600 text-sm mb-2">{t('patientView.listeningText')}</p>
          <p className="text-lg font-semibold text-center text-blue-900">
            {currentSentence}
          </p>
        </div>
      )}

      {isPaused && (
        <div className="bg-white border border-blue-200 rounded-lg p-6 space-y-4">
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder={t('patientView.questionPlaceholder') || 'Stellen Sie hier Ihre Frage'}
            style={{ minHeight: 120, fontSize: 20 }}
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isAsking}
          />
          <button
            onClick={handleSendQuestion}
            disabled={isAsking}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition min-w-[150px]"
          >
            {isAsking ? t('patientView.sendingQuestion') || 'Frage senden...' : t('patientView.sendQuestion') || 'Frage senden'}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-300 rounded-lg p-6 max-h-96 overflow-y-auto">
        <div className="text-base leading-relaxed text-gray-800">
          {sentences.map((sentence, index) => (
            <span
              key={index}
              className={index === highlightedSentenceIndex ? 'bg-yellow-100 rounded px-1' : ''}
            >
              {sentence}{' '}
            </span>
          ))}
        </div>
      </div>

      {isPlaying && (
        <p className="text-sm text-gray-600 text-center animate-pulse">
          {t('common.loading')}...
        </p>
      )}
    </div>
  )
}
