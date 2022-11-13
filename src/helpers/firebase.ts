import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCgu7EVRrz3LQnDypCJJDOX3BRUYHqVZus",
  authDomain: "awardwiz.firebaseapp.com",
  projectId: "awardwiz",
  storageBucket: "awardwiz.appspot.com",
  messagingSenderId: "416370374153",
  appId: "1:416370374153:web:12727dfb0493bf268b6ad8",
  measurementId: "G-6JPRBFR4Y6"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(app)
export const firestore = getFirestore(app)
