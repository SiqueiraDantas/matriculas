// MIS Educa — Início: Auth guard, KPI, tabela com busca, edição inline e EXCLUSÃO

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
  runTransaction,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -------------------- ELEMENTOS DA UI -------------------- */
const kpiInscritosEl   = document.getElementById("kpiInscritos");
const kpiCard          = document.querySelector(".card.kpi");

const secTabela        = document.getElementById("tabelaAlunos");
const tabelaBody       = document.querySelector("#tabelaMatriculas tbody");
const btnMostrarTabela = document.getElementById("btnMostrarTabela");
const filtroInput      = document.getElementById("filtroTabela");

const menuToggle       = document.getElementById("menuToggle");
const sidebar          = document.getElementById("sidebar");
const btnLogout        = document.getElementById("btnLogout");

/* -------------------- AUTH GUARD -------------------- */
const LOGIN_PAGE = "login.html";
let guardHandled = false;
function safeReplace(url) {
  if (guardHandled) return;
  guardHandled = true;
  window.location.replace(url);
}

onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname.toLowerCase();
  const isOnLogin = path.endsWith("/login") || path.endsWith("/login.html");

  if (!user) {
    if (!isOnLogin) safeReplace(LOGIN_PAGE);
    return;
  }

  try {
    await atualizarKpiTotal();
    wireUI();
  } catch (e) {
    console.error("Erro ao iniciar painel:", e);
  }
});

/* -------------------- KPI: TOTAL DE INSCRITOS -------------------- */
async function atualizarKpiTotal() {
  try {
    const coll = collection(db, "matriculas");
    const snapCount = await getCountFromServer(coll);
    if (kpiInscritosEl) {
      kpiInscritosEl.textContent = snapCount.data().count.toLocaleString("pt-BR");
    }
  } catch (error) {
    console.error("Erro ao contar inscritos:", error);
    if (kpiInscritosEl) kpiInscritosEl.textContent = "—";
  }
}

/* -------------------- TABELA: CARREGAR MATRÍCULAS -------------------- */
async function carregarTabelaMatriculas() {
  if (!tabelaBody) return;

  tabelaBody.innerHTML = `<tr><td colspan="17">🔄 Carregando dados...</td></tr>`;

  try {
    let snap;
    // Ordena por dataEnvio; fallback: createdAt
    try {
      const q1 = query(collection(db, "matriculas"), orderBy("dataEnvio", "desc"));
      snap = await getDocs(q1);
    } catch (e1) {
      console.warn("orderBy(dataEnvio) falhou, tentando createdAt…", e1.code || e1.message);
      const q2 = query(collection(db, "matriculas"), orderBy("createdAt", "desc"));
      snap = await getDocs(q2);
    }

    const linhas = [];
    snap.forEach((docu) => {
      const d = docu.data();
      linhas.push(`
        <tr data-id="${docu.id}">
          <td>${safe(d.numeroMatricula)}</td>
          <td>${safe(d.nome)}</td>
          <td>${safe(d.cpf)}</td>
          <td>${safe(d.idade)}</td>
          <td>${safe(d.sexo)}</td>
          <td>${safe(d.raca)}</td>
          <td>${safe(d.religiao)}</td>
          <td>${safe(d.escola)}</td>
          <td>${safe(d.rede)}</td>
          <td>${d.tipoMatricula === "A" ? "Matrícula" : (d.tipoMatricula === "B" ? "Rematrícula" : "-")}</td>
          <td>${Array.isArray(d.oficinas) ? d.oficinas.join(", ") : "-"}</td>
          <td>${Array.isArray(d.programas) ? d.programas.join(", ") : "-"}</td>
          <td>${safe(d?.responsavel?.nome)}</td>
          <td>${safe(d?.responsavel?.telefone)}</td>
          <td>${safe(d?.responsavel?.email)}</td>
          <td>${safe(d?.responsavel?.integrantes)}</td>
          <td class="td-actions">
            <button class="btn xs btn-edit" data-action="edit" data-id="${docu.id}">Editar</button>
            <button class="btn xs danger btn-delete" data-action="delete" data-id="${docu.id}">Excluir</button>
          </td>
        </tr>
      `);
    });

    tabelaBody.innerHTML = linhas.length
      ? linhas.join("")
      : `<tr><td colspan="17">Nenhuma matrícula encontrada.</td></tr>`;
  } catch (erro) {
    console.error("Erro ao buscar matrículas:", erro);
    tabelaBody.innerHTML = `<tr><td colspan="17">❌ Erro ao carregar dados.</td></tr>`;
  }
}

/* -------------------- EDIÇÃO/EXCLUSÃO (delegação) -------------------- */
tabelaBody?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;

  const tr = btn.closest("tr");
  const id = tr?.getAttribute("data-id");
  if (!tr || !id) return;

  const action = btn.getAttribute("data-action");

  // Índices de colunas (1-based) compatíveis com o thead atual:
  // 1 Nº Matrícula
  // 2 Nome
  // 3 CPF
  // 4 Idade
  // 5 Sexo
  // 6 Raça
  // 7 Religião
  // 8 Escola
  // 9 Rede
  // 10 Tipo
  // 11 Oficinas (CSV)
  // 12 Programas (CSV)
  // 13 Resp. Nome
  // 14 Resp. Telefone
  // 15 Resp. E-mail
  // 16 Integrantes
  // 17 Ações
  const EDIT_COL_START = 2;
  const EDIT_COL_END   = 16;

  if (action === "edit") {
    for (let i = EDIT_COL_START; i <= EDIT_COL_END; i++) {
      const td = tr.children[i - 1];
      if (!td) continue;
      const val = td.textContent.trim();
      td.dataset.old = val;
      td.innerHTML = `<input type="text" value="${val === "-" ? "" : escapeHtmlAttr(val)}" />`;
    }
    btn.textContent = "Salvar";
    btn.classList.remove("btn-edit");
    btn.classList.add("btn-save", "success");
    btn.setAttribute("data-action", "save");

    const tdAcoes = tr.lastElementChild;
    const cancel = document.createElement("button");
    cancel.className = "btn xs btn-cancel neutral";
    cancel.textContent = "Cancelar";
    cancel.setAttribute("data-action", "cancel");
    cancel.setAttribute("data-id", id);
    tdAcoes.appendChild(cancel);
  }

  if (action === "cancel") {
    for (let i = EDIT_COL_START; i <= EDIT_COL_END; i++) {
      const td = tr.children[i - 1];
      if (!td) continue;
      td.textContent = td.dataset.old ?? td.textContent;
      delete td.dataset.old;
    }
    const main = tr.querySelector('button[data-action="save"]');
    if (main) {
      main.textContent = "Editar";
      main.className = "btn xs btn-edit";
      main.setAttribute("data-action", "edit");
    }
    btn.remove();
  }

  if (action === "save") {
    const getVal = (idx) => tr.children[idx - 1].querySelector("input")?.value.trim() || "";

    const payload = {
      nome: getVal(2) || null,
      cpf: getVal(3) || null,
      idade: getVal(4) ? Number(getVal(4)) : null,
      sexo: getVal(5) || null,
      raca: getVal(6) || null,
      religiao: getVal(7) || null,
      escola: getVal(8) || null,
      rede: getVal(9) || null,
      tipoMatricula: (() => {
        const v = (getVal(10) || "").toLowerCase();
        if (v.startsWith("a") || v.includes("matr")) return "A";
        if (v.startsWith("b") || v.includes("rema")) return "B";
        return null;
      })(),
      oficinas: getVal(11) ? getVal(11).split(",").map(s => s.trim()).filter(Boolean) : [],
      programas: getVal(12) ? getVal(12).split(",").map(s => s.trim()).filter(Boolean) : [],
      responsavel: {
        nome: getVal(13) || null,
        telefone: getVal(14) || null,
        email: getVal(15) || null,
        integrantes: getVal(16) || null,
      },
    };

    const clean = (obj) => {
      Object.entries(obj).forEach(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) clean(v);
        if (v === null) delete obj[k];
        if (Array.isArray(v) && v.length === 0) delete obj[k];
      });
      return obj;
    };

    try {
      await updateDoc(doc(db, "matriculas", id), clean(payload));

      const valOrDash = (x) => (x && String(x).trim().length ? x : "-");
      tr.children[1].textContent  = valOrDash(getVal(2));
      tr.children[2].textContent  = valOrDash(getVal(3));
      tr.children[3].textContent  = valOrDash(getVal(4));
      tr.children[4].textContent  = valOrDash(getVal(5));
      tr.children[5].textContent  = valOrDash(getVal(6));
      tr.children[6].textContent  = valOrDash(getVal(7));
      tr.children[7].textContent  = valOrDash(getVal(8));
      tr.children[8].textContent  = valOrDash(getVal(9));
      tr.children[9].textContent  = (() => {
        const v = (getVal(10) || "").toLowerCase();
        if (v.startsWith("a") || v.includes("matr")) return "Matrícula";
        if (v.startsWith("b") || v.includes("rema")) return "Rematrícula";
        return "-";
      })();
      tr.children[10].textContent = valOrDash(getVal(11));
      tr.children[11].textContent = valOrDash(getVal(12));
      tr.children[12].textContent = valOrDash(getVal(13));
      tr.children[13].textContent = valOrDash(getVal(14));
      tr.children[14].textContent = valOrDash(getVal(15));
      tr.children[15].textContent = valOrDash(getVal(16));

      for (let i = EDIT_COL_START; i <= EDIT_COL_END; i++) {
        delete tr.children[i - 1].dataset.old;
      }

      btn.textContent = "Editar";
      btn.className = "btn xs btn-edit";
      btn.setAttribute("data-action", "edit");
      const cancel = tr.querySelector('button[data-action="cancel"]');
      cancel?.remove();
    } catch (e) {
      console.error("Falha ao salvar:", e);
      alert("❌ Não foi possível salvar as alterações.");
    }
  }

  if (action === "delete") {
    try {
      const matRef = doc(db, "matriculas", id);
      const snap = await getDoc(matRef);
      if (!snap.exists()) {
        alert("Registro não encontrado.");
        return;
      }
      const d = snap.data();
      const nome = d?.nome || "-";

      if (!confirm(`Excluir a matrícula de "${nome}"?\nEsta ação removerá a matrícula e devolverá as vagas nas oficinas selecionadas.`)) {
        return;
      }

      // Monta refs das oficinas a partir de IDs (preferencial)
      let oficinaRefs = [];
      if (Array.isArray(d?.oficinaIds) && d.oficinaIds.length) {
        oficinaRefs = d.oficinaIds.map((oid) => doc(db, "oficinas", oid));
      } else if (Array.isArray(d?.oficinas) && d.oficinas.length) {
        // fallback: procurar por nome
        for (const nomeOf of d.oficinas) {
          const qs = await getDocs(query(collection(db, "oficinas"), where("nome", "==", nomeOf)));
          qs.forEach((ofiDoc) => oficinaRefs.push(doc(db, "oficinas", ofiDoc.id)));
        }
      }

      // Transação: decrementa inscritos (sem ficar negativo) e apaga matrícula
      await runTransaction(db, async (t) => {
        for (const ref of oficinaRefs) {
          const s = await t.get(ref);
          if (s.exists()) {
            const atual = Number(s.data().inscritos || 0);
            t.update(ref, { inscritos: Math.max(0, atual - 1) });
          }
        }
        t.delete(matRef);
      });

      // Remove a linha e atualiza KPI
      tr.remove();
      await atualizarKpiTotal();
      alert("Matrícula excluída com sucesso.");
    } catch (e) {
      console.error("Erro ao excluir:", e);
      alert("❌ Não foi possível excluir a matrícula.");
    }
  }
});

/* -------------------- WIRING GERAL DA INTERFACE -------------------- */
function wireUI() {
  // Menu (mobile)
  menuToggle?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  // Fecha sidebar ao clicar fora (mobile)
  document.addEventListener("click", (e) => {
    if (!sidebar) return;
    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedToggle = menuToggle && menuToggle.contains(e.target);
    if (!clickedInsideSidebar && !clickedToggle) {
      document.body.classList.remove("sidebar-open");
    }
  });

  // Logout
  btnLogout?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      safeReplace(LOGIN_PAGE);
    } catch (e) {
      console.error("Erro ao sair:", e);
    }
  });

  // Mostrar/Ocultar tabela (botão)
  if (btnMostrarTabela && secTabela) {
    btnMostrarTabela.addEventListener("click", async () => {
      const isHidden = secTabela.classList.contains("hidden");
      if (isHidden) {
        secTabela.classList.remove("hidden");
        await carregarTabelaMatriculas();
      } else {
        secTabela.classList.add("hidden");
      }
    });
  }

  // Mostrar/Ocultar tabela (card KPI)
  if (kpiCard && secTabela) {
    kpiCard.addEventListener("click", async () => {
      const isHidden = secTabela.classList.contains("hidden");
      if (isHidden) {
        secTabela.classList.remove("hidden");
        await carregarTabelaMatriculas();
      } else {
        secTabela.classList.add("hidden");
      }
    });
  }

  // Filtro por nome
  filtroInput?.addEventListener("input", () => {
    const q = filtroInput.value.toLowerCase();
    const rows = document.querySelectorAll("#tabelaMatriculas tbody tr");
    rows.forEach((tr) => {
      const nome = (tr.querySelector("td:nth-child(2)")?.textContent || "").toLowerCase();
      tr.style.display = nome.includes(q) ? "" : "none";
    });
  });
}

/* -------------------- HELPERS -------------------- */
function safe(v) {
  if (v === undefined || v === null || v === "") return "-";
  return String(v);
}
function escapeHtmlAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
