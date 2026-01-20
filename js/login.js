// js/login.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const erroEl = document.getElementById("erro");
const btnSubmit = document.getElementById("btnEntrar");

// ano
const btnAno2025 = document.getElementById("btnAno2025");
const btnAno2026 = document.getElementById("btnAno2026");
const anoInfo = document.getElementById("anoInfo");

const REDIRECT_AFTER_LOGIN = "index.html";

// evita múltiplos redirects
let redirected = false;
function safeReplace(url) {
  if (redirected) return;
  redirected = true;
  window.location.replace(url);
}

function msgErroBr(code) {
  switch (code) {
    case "auth/invalid-email": return "E-mail inválido.";
    case "auth/missing-password": return "Informe a senha.";
    case "auth/user-not-found": return "Usuário não encontrado.";
    case "auth/wrong-password": return "Senha incorreta.";
    case "auth/user-disabled": return "Usuário desativado.";
    case "auth/too-many-requests": return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/network-request-failed": return "Falha de rede. Verifique sua conexão.";
    default: return "Não foi possível entrar. Verifique os dados e tente novamente.";
  }
}

// ===== ANO =====
function getSelectedYear() {
  const y = localStorage.getItem("MIS_ANO") || "2026";
  return (y === "2025" || y === "2026") ? y : "2026";
}

function updateYearUI() {
  const year = getSelectedYear();
  btnAno2025?.classList.toggle("ativo", year === "2025");
  btnAno2026?.classList.toggle("ativo", year === "2026");
  if (anoInfo) anoInfo.textContent = "Ano selecionado: " + year;
}

function setSelectedYear(year) {
  localStorage.setItem("MIS_ANO", year);
  // IMPORTANTE: recarrega pra firebase-config iniciar no projeto correto
  window.location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
  updateYearUI();
  btnAno2025?.addEventListener("click", () => setSelectedYear("2025"));
  btnAno2026?.addEventListener("click", () => setSelectedYear("2026"));
});

// Se já estiver logado e está no login, manda pro painel
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname.toLowerCase();
  const isOnLogin = path.endsWith("/login") || path.endsWith("/login.html");
  if (user && isOnLogin) {
    safeReplace(REDIRECT_AFTER_LOGIN);
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroEl.textContent = "";

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    erroEl.textContent = "Preencha e-mail e senha.";
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Entrando...";

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    safeReplace(REDIRECT_AFTER_LOGIN);
  } catch (err) {
    console.error("Erro de login:", err);
    erroEl.textContent = msgErroBr(err.code);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Entrar";
  }
});
