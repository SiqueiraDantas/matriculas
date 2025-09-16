// js/firebase-config.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Se for usar Storage para fotos/anexos, descomente:
// import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzavu7lRQPAi--SFecOg2FE6f0WlDyTPE",
  authDomain: "matriculas-madeinsertao.firebaseapp.com",
  projectId: "matriculas-madeinsertao",
  storageBucket: "matriculas-madeinsertao.appspot.com",
  messagingSenderId: "426884127493",
  appId: "1:426884127493:web:7c83d74f972af209c8b56c"
};

// Evita reinicializar o app se já estiver iniciado
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Serviços do Firebase
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app);

export { app, auth, db /*, storage*/ };
