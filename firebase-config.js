// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAITctbCiAELU_wzUELdRfUUZfFYvF96Ao",
  authDomain: "linkly-shortner.firebaseapp.com",
  projectId: "linkly-shortner",
  storageBucket: "linkly-shortner.firebasestorage.app",
  messagingSenderId: "1009858915742",
  appId: "1:1009858915742:web:28fdd0d3ca539da8ca3a8f",
  measurementId: "G-KNZ28WSB63"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);