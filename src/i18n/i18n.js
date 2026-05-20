import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'
import tr from './tr.json'
import ru from './ru.json'
import ar from './ar.json'
import fa from './fa.json'

// Ressourcen definieren
const resources = {
  de: { translation: de },
  en: { translation: en },
  tr: { translation: tr },
  ru: { translation: ru },
  ar: { translation: ar },
  fa: { translation: fa }
}

// i18n initialisieren
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'de', // Standardsprache
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false // React schützt bereits vor XSS
    },
    detection: {
      // Browser-Sprache automatisch erkennen
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

export default i18n
