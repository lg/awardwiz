import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"
import { connectFunctionsEmulator, getFunctions } from "firebase/functions"

// Initialize Firebase
if (!Object.keys(import.meta.env).includes("VITE_FIREBASE_CONFIG_JSON")) throw new Error("Missing VITE_FIREBASE_CONFIG_JSON environment variable")
export const firebaseApp = initializeApp(JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG_JSON))
export const firebaseAuth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)
export const firebaseFunctions = getFunctions(firebaseApp)
export let firebaseFunctionsUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(firebaseAuth, "http://localhost:9099")
  connectFirestoreEmulator(firestore, "localhost", 8080)
  connectFunctionsEmulator(firebaseFunctions, "localhost", 5001)
  firebaseFunctionsUrl = "http://127.0.0.1:5001/awardwiz/us-central1"
}
