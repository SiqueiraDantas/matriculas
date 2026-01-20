// js/firebase-config.js (MULTI-BANCO 2025 / 2026)

import {
  initializeApp,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===============================
// CONFIGS (2025 / 2026)
// ===============================
const FIREBASE_CONFIGS = {
  "2025": {
    apiKey: "AIzaSyAzavu7lRQPAi--SFecOg2FE6f0WlDyTPE",
    authDomain: "matriculas-madeinsertao.firebaseapp.com",
    projectId: "matriculas-madeinsertao",
    storageBucket: "matriculas-madeinsertao.firebasestorage.app",
    messagingSenderId: "426884127493",
    appId: "1:426884127493:web:7c83d74f972af209c8b56c",
    measurementId: "G-V2DH0RHXEE"
  },

  "2026": {
    apiKey: "AIzaSyB79TFuSXVbYprURdw5Q5jI9xxc6DkDOMQ",
    authDomain: "matriculas-cfdd0.firebaseapp.com",
    projectId: "matriculas-cfdd0",
    storageBucket: "matriculas-cfdd0.firebasestorage.app",
    messagingSenderId: "697940252168",
    appId: "1:697940252168:web:0822cc5e1e94b083dde3bd",
    measurementId: "G-ZBPXGL357R"
  }
};

// ===============================
// ANO SELECIONADO
// ===============================
function getSelectedYear() {
  const y = localStorage.getItem("MIS_ANO") || "2026";
  return (y === "2025" || y === "2026") ? y : "2026";
}

// ===============================
// INIT APP POR ANO
// ===============================
function initAppByYear(year) {
  const cfg = FIREBASE_CONFIGS[year];
  if (!cfg) throw new Error("Ano inválido: " + year);

  const appName = "MIS_" + year;

  // se já existe, reutiliza; senão cria
  try {
    return getApp(appName);
  } catch (e) {
    return initializeApp(cfg, appName);
  }
}

// ===============================
// EXPORTA SERVIÇOS
// ===============================
const YEAR = getSelectedYear();
const app = initAppByYear(YEAR);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Debug
console.log("[FIREBASE OK] year =", YEAR, "| projectId =", FIREBASE_CONFIGS[YEAR].projectId);
