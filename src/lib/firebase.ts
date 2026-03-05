import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function sanitizeEnvValue(value: string | undefined) {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

const firebaseConfig = {
  apiKey: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
}

export const firebaseAuthDomain = firebaseConfig.authDomain
export const firebaseProjectId = firebaseConfig.projectId

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const googleProvider = app ? new GoogleAuthProvider() : null
