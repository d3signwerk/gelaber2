import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  uploadBytes,
  getBytes,
  getDownloadURL
} from 'firebase/storage'
import * as pdfjsLib from 'pdfjs-dist'
import { translateText } from './mistral'

// Firebase-Konfiguration aus Umgebungsvariablen laden
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Firebase App initialisieren
const app = initializeApp(firebaseConfig)

// Firebase Services
const auth = getAuth(app)
export { auth }
const db = getFirestore(app)
const storage = getStorage(app)
console.log('Storage Bucket:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)
export { db, storage }

// PDF.js Worker setzen
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// Persistenz aktivieren
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('Fehler beim Setzen der Auth-Persistenz:', err)
})

// ============= AUTHENTIFIZIERUNG =============

/**
 * Admin mit E-Mail und Passwort anmelden
 */
export const loginAdmin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  } catch (error) {
    console.error('Login-Fehler:', error)
    throw error
  }
}

/**
 * Admin abmelden
 */
export const logoutAdmin = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Logout-Fehler:', error)
    throw error
  }
}

/**
 * Authentifizierungsstatus überwachen
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback)
}

/**
 * Aktuellen authentifizierten User abrufen
 */
export const getCurrentUser = () => auth.currentUser

// ============= DOKUMENTE =============

/**
 * PDF-Text extrahieren mit pdf.js
 */
export const extractTextFromPDF = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    
    let fullText = ''
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }
    
    return fullText
  } catch (error) {
    console.error('PDF-Extraktions-Fehler:', error)
    throw new Error('Fehler beim Extrahieren des PDF-Textes')
  }
}

/**
 * Dokument hochladen (mit automatischer Übersetzung in die jeweils andere Sprache)
 */
export const uploadDocument = async (file, documentName, language) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('NOT_AUTHENTICATED')

    const extractedText = await extractTextFromPDF(file)

    const targetLanguage = language === 'de' ? 'en' : 'de'
    let translatedText = ''
    try {
      translatedText = await translateText(extractedText, targetLanguage)
    } catch (err) {
      console.warn('Übersetzung fehlgeschlagen:', err)
      translatedText = extractedText
    }

    const base64Pdf = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        const commaIndex = typeof result === 'string' ? result.indexOf(',') : -1
        const b64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result
        resolve(b64)
      }
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(file)
    })

    const docRef = await addDoc(collection(db, 'documents'), {
      name: documentName,
      language: language,
      pdfBase64: base64Pdf,
      extractedText: extractedText,
      extractedTextDe: language === 'de' ? extractedText : translatedText,
      extractedTextEn: language === 'en' ? extractedText : translatedText,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    })

    return {
      id: docRef.id,
      name: documentName,
      language: language,
      extractedText: extractedText,
      extractedTextDe: language === 'de' ? extractedText : translatedText,
      extractedTextEn: language === 'en' ? extractedText : translatedText,
      createdAt: new Date()
    }
  } catch (error) {
    console.error('Dokument-Upload-Fehler:', error)
    throw error
  }
}

/**
 * Alle Dokumente abrufen
 */
export const getDocuments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'documents'))
    const documents = []
    
    querySnapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      })
    })
    
    return documents
  } catch (error) {
    console.error('Fehler beim Abrufen der Dokumente:', error)
    throw error
  }
}

/**
 * Einzelnes Dokument abrufen
 */
export const getDocument = async (docId) => {
  try {
    const docRef = doc(db, 'documents', docId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      }
    }
    
    return null
  } catch (error) {
    console.error('Fehler beim Abrufen des Dokuments:', error)
    throw error
  }
}

/**
 * Dokument löschen
 */
export const deleteDocument = async (docId) => {
  try {
    // Zuerst die Firestore-Referenz löschen
    await deleteDoc(doc(db, 'documents', docId))
  } catch (error) {
    console.error('Fehler beim Löschen des Dokuments:', error)
    throw error
  }
}

// ============= PATIENTEN =============

/**
 * Neuen Patienten mit manueller ID erstellen
 */
export const createPatient = async (patientId, name) => {
  try {
    const patientRef = doc(db, 'patients', patientId)
    await setDoc(patientRef, {
      patientId: patientId,
      name: name,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    })
    return { id: patientId, patientId, name, createdAt: new Date() }
  } catch (error) {
    console.error('Fehler beim Erstellen des Patienten:', error)
    throw error
  }
}

export const getPatientByCustomId = async (patientId) => {
  try {
    const patientRef = doc(db, 'patients', patientId)
    const patientSnap = await getDoc(patientRef)
    if (patientSnap.exists()) {
      return { id: patientSnap.id, ...patientSnap.data() }
    }
    return null
  } catch (error) {
    console.error('Fehler beim Abrufen des Patienten:', error)
    throw error
  }
}

/**
 * Alle Patienten abrufen
 */
export const getPatients = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'patients'))
    const patients = []
    
    querySnapshot.forEach(doc => {
      patients.push({
        id: doc.id,
        ...doc.data()
      })
    })
    
    return patients
  } catch (error) {
    console.error('Fehler beim Abrufen der Patienten:', error)
    throw error
  }
}

/**
 * Einzelnen Patienten abrufen
 */
export const getPatient = async (patientId) => {
  try {
    const docRef = doc(db, 'patients', patientId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      }
    }
    
    return null
  } catch (error) {
    console.error('Fehler beim Abrufen des Patienten:', error)
    throw error
  }
}

/**
 * Dokument für Patienten zuweisen
 */
export const assignDocumentToPatient = async (patientId, documentId) => {
  try {
    const patientRef = doc(db, 'patients', patientId)
    await updateDoc(patientRef, {
      assignedDocumentId: documentId
    })
  } catch (error) {
    console.error('Fehler beim Zuweisen des Dokuments:', error)
    throw error
  }
}

/**
 * Patienten löschen
 */
export const deletePatient = async (patientId) => {
  try {
    await deleteDoc(doc(db, 'patients', patientId))
  } catch (error) {
    console.error('Fehler beim Löschen des Patienten:', error)
    throw error
  }
}

export const logSessionEvent = async (patientId, documentId, question, answer) => {
  try {
    await addDoc(collection(db, 'sessionLogs'), {
      patientId: patientId,
      documentId: documentId,
      question: question,
      answer: answer,
      timestamp: serverTimestamp()
    })
  } catch (error) {
    console.error('Fehler beim Loggen:', error)
  }
}

export default {
  auth,
  db,
  storage,
  loginAdmin,
  logoutAdmin,
  onAuthChange,
  getCurrentUser,
  extractTextFromPDF,
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  createPatient,
  getPatients,
  getPatient,
  assignDocumentToPatient,
  deletePatient,
  logSessionEvent,
  getPatientByCustomId
}
