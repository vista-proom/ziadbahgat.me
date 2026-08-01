// Firebase Web SDK v10 (ES Modules via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBytCsW1ZF8wNZGuhcgQ25K4KdnVQL18HA",
  authDomain: "ziadbahgat-portfolio.firebaseapp.com",
  projectId: "ziadbahgat-portfolio",
  storageBucket: "ziadbahgat-portfolio.firebasestorage.app",
  messagingSenderId: "1054186455452",
  appId: "1:1054186455452:web:282d1d99e3dfcae20c8859",
  measurementId: "G-Z0SX87VDFZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
