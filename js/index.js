// MIS Educa — Início: Auth guard, KPI, tabela com busca + filtro de oficina, edição inline e EXCLUSÃO

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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -------------------- ELEMENTOS DA UI -------------------- */
const kpiInscritosEl   = document.getElementById("kpiInscritos");
const kpiCard          = document.querySelector(".card.kpi");

const secTabela        = document.getElementById("tabelaAlunos");
const tabelaBody       = document.querySelector("#tabelaMatriculas tbody");
const btnMostrarTabela = document.getElementById("btnMostrarTabela");
const filtroInput      = document.getElementById("filtroTabela");
const filtroOficinaEl  = document.getElementById("filtroOficina"); // ✅ NOVO

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

/* -------------------- CACHE EM MEMÓRIA (para filtros) -------------------- */
let cacheMatriculas = []; // [{ id, data }]

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

/* -------------------- TABELA: RENDER (a partir da lista filtrada) -------------------- */
function renderizarTabelaMatriculas(lista) {
  if (!tabelaBody) return;

  const linhas = (lista || []).map(({ id, data }) => {
    const d = data || {};
    return `
      <tr data-id="${id}">
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
        <td>${safe(d && d.responsavel ? d.responsavel.nome : null)}</td>
        <td>${safe(d && d.responsavel ? d.responsavel.telefone : null)}</td>
        <td>${safe(d && d.responsavel ? d.responsavel.email : null)}</td>
        <td>${safe(d && d.responsavel ? d.responsavel.integrantes : null)}</td>
        <td class="td-actions">
          <button class="btn xs btn-edit" data-action="edit" data-id="${id}">Editar</button>
          <button class="btn xs danger btn-delete" data-action="delete" data-id="${id}">Excluir</button>
        </td>
      </tr>
    `;
  });

  tabelaBody.innerHTML = linhas.length
    ? linhas.join("")
    : `<tr><td colspan="17">Nenhuma matrícula encontrada.</td></tr>`;
}

/* -------------------- POPULAR SELECT DE OFICINAS -------------------- */
function normalizarOficinasDoRegistro(d) {
  if (!d) return [];
  if (Array.isArray(d.oficinas)) return d.oficinas.map(s => String(s || "").trim()).filter(Boolean);
  if (typeof d.oficinas === "string") return d.oficinas.split(",").map(s => s.trim()).filter(Boolean);
  if (typeof d.oficina === "string") return [d.oficina.trim()].filter(Boolean);
  return [];
}

function popularFiltroOficinas() {
  if (!filtroOficinaEl) return;

  const setOficinas = new Set();
  cacheMatriculas.forEach(({ data }) => {
    normalizarOficinasDoRegistro(data).forEach(o => {
      if (o) setOficinas.add(o);
    });
  });

  const valorAtual = filtroOficinaEl.value || "todas";

  filtroOficinaEl.innerHTML = `<option value="todas">Todas as Oficinas</option>`;

  Array.from(setOficinas)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((oficina) => {
      const opt = document.createElement("option");
      opt.value = oficina;
      opt.textContent = oficina;
      filtroOficinaEl.appendChild(opt);
    });

  // tenta manter seleção se ainda existir
  if ([...filtroOficinaEl.options].some(o => o.value === valorAtual)) {
    filtroOficinaEl.value = valorAtual;
  } else {
    filtroOficinaEl.value = "todas";
  }
}

/* -------------------- APLICAR FILTROS (NOME + OFICINA) -------------------- */
function aplicarFiltros() {
  const qNome = (filtroInput?.value || "").toLowerCase().trim();
  const oficinaSel = filtroOficinaEl?.value || "todas";

  const filtrados = cacheMatriculas.filter(({ data }) => {
    const nome = (data?.nome || "").toLowerCase();
    const passouNome = !qNome || nome.includes(qNome);

    const oficinas = normalizarOficinasDoRegistro(data);
    const passouOficina = (oficinaSel === "todas") || oficinas.includes(oficinaSel);

    return passouNome && passouOficina;
  });

  renderizarTabelaMatriculas(filtrados);
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

    // monta cache
    cacheMatriculas = [];
    snap.forEach((docu) => {
      cacheMatriculas.push({ id: docu.id, data: docu.data() });
    });

    // popula o select e aplica filtros atuais
    popularFiltroOficinas();
    aplicarFiltros();
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

      // ✅ Atualiza o cache para manter filtros corretos
      const idx = cacheMatriculas.findIndex(x => x.id === id);
      if (idx !== -1) {
        const antigo = cacheMatriculas[idx].data || {};
        cacheMatriculas[idx].data = {
          ...antigo,
          nome: payload.nome ?? antigo.nome,
          cpf: payload.cpf ?? antigo.cpf,
          idade: payload.idade ?? antigo.idade,
          sexo: payload.sexo ?? antigo.sexo,
          raca: payload.raca ?? antigo.raca,
          religiao: payload.religiao ?? antigo.religiao,
          escola: payload.escola ?? antigo.escola,
          rede: payload.rede ?? antigo.rede,
          tipoMatricula: payload.tipoMatricula ?? antigo.tipoMatricula,
          oficinas: payload.oficinas ?? antigo.oficinas,
          programas: payload.programas ?? antigo.programas,
          responsavel: {
            ...(antigo.responsavel || {}),
            ...(payload.responsavel || {}),
          },
        };
      }

      // se mudou oficina, atualiza lista do select
      popularFiltroOficinas();
      aplicarFiltros();
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
      const nome = (d && d.nome) ? d.nome : "-";

      if (!confirm(`Excluir a matrícula de "${nome}"?\nEsta ação removerá o registro definitivamente.`)) {
        return;
      }

      await deleteDoc(matRef);

      // ✅ remove do cache + aplica filtros (sem reload)
      cacheMatriculas = cacheMatriculas.filter(x => x.id !== id);

      popularFiltroOficinas();
      aplicarFiltros();

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
  menuToggle?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  document.addEventListener("click", (e) => {
    if (!sidebar) return;
    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedToggle = menuToggle && menuToggle.contains(e.target);
    if (!clickedInsideSidebar && !clickedToggle) {
      document.body.classList.remove("sidebar-open");
    }
  });

  btnLogout?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      safeReplace(LOGIN_PAGE);
    } catch (e) {
      console.error("Erro ao sair:", e);
    }
  });

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

  // ✅ Agora o filtro por nome filtra pelo cache (junto com oficina)
  filtroInput?.addEventListener("input", aplicarFiltros);

  // ✅ Filtro por oficina
  filtroOficinaEl?.addEventListener("change", aplicarFiltros);
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
