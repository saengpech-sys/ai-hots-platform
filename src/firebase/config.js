// src/firebase/config.js

// Import the functions you need from the SDKs
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
// Firestore & Auth will be dynamically imported to reduce initial bundle.

// Your web app's Firebase configuration that you copied
const firebaseConfig = {
  apiKey: 'AIzaSyA9ezFYsXoBatehG-iUvHdkfn1YZSdW1zQ',
  authDomain: 'ai-hots-platform.firebaseapp.com',
  projectId: 'ai-hots-platform',
  storageBucket: 'ai-hots-platform.firebasestorage.app',
  messagingSenderId: '137393916587',
  appId: '1:137393916587:web:e35e36a7d7813e89d245ee',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Transport knobs controlled via Vite env for easy switching per environment
// VITE_FIRESTORE_FORCE_LP: 'true' | 'false' (default 'true')
// VITE_FIRESTORE_AUTO_DETECT_LP: 'true' | 'false' (default 'false')
// VITE_FIRESTORE_FETCH_STREAMS: 'true' | 'false' (default 'false')
// Default: rely on auto detection; allow override
const forceLongPolling = (import.meta.env?.VITE_FIRESTORE_FORCE_LP ?? 'false') === 'true'
const autoDetectLongPolling = (import.meta.env?.VITE_FIRESTORE_AUTO_DETECT_LP ?? 'true') === 'true'
const useFetch = (import.meta.env?.VITE_FIRESTORE_FETCH_STREAMS ?? 'false') === 'true'

let _db
// Eager Auth (keeps legacy code using imported `auth` working)
let _auth = null

export async function getFirestoreInstance() {
  if (_db) return _db
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } =
    await import('firebase/firestore')
  _db = initializeFirestore(app, {
    experimentalForceLongPolling: forceLongPolling,
    experimentalAutoDetectLongPolling: autoDetectLongPolling,
    useFetchStreams: useFetch,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  try {
    setLogLevel('error')
  } catch {}
  return _db
}

export async function getAuthInstance() {
  if (_auth) return _auth
  _auth = getAuth(app)
  return _auth
}
// Explicitly point to the correct bucket to avoid mismatches
// Lazy storage accessor to avoid pulling storage SDK into initial bundle if not used immediately
let _storage
export async function getStorageInstance() {
  if (_storage) return _storage
  const { getStorage } = await import('firebase/storage')
  _storage = getStorage(app, 'gs://ai-hots-platform.firebasestorage.app')
  return _storage
}

// Backward compatibility named exports
export const db = undefined // Firestore still lazy – do not use directly
export const auth = getAuth(app)
