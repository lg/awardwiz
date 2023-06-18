import { initializeApp } from "firebase/app"
import type { FirebaseOptions } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"

// Initialize Firebase
if (!Object.keys(import.meta.env).includes("VITE_FIREBASE_CONFIG_JSON")) throw new Error("Missing VITE_FIREBASE_CONFIG_JSON environment variable")
export const firebaseApp = initializeApp(JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG_JSON) as FirebaseOptions)
export const firebaseAuth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(firebaseAuth, "http://localhost:9099")
  connectFirestoreEmulator(firestore, "localhost", 8080)
}
