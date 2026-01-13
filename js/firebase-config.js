// js/firebase-config.js (NOVO BANCO - matriculas-cfdd0)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB79TFuSXVbYprURdw5Q5jI9xxc6DkDOMQ",
  authDomain: "matriculas-cfdd0.firebaseapp.com",
  projectId: "matriculas-cfdd0",
  storageBucket: "matriculas-cfdd0.firebasestorage.app",
  messagingSenderId: "697940252168",
  appId: "1:697940252168:web:0822cc5e1e94b083dde3bd",
  measurementId: "G-ZBPXGL357R",
};

// Inicializa
const app = initializeApp(firebaseConfig);

// Exporta para uso no index.js / login.js / etc
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Debug (pra garantir que tá no banco certo)
console.log("[FIREBASE OK] projectId =", firebaseConfig.projectId);
