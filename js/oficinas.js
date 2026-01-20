// js/oficinas.js (compat) — CRUD de oficinas + auth guard + erros amigáveis

// --------- Firebase config ---------
const firebaseConfig = {
  apiKey: "AIzaSyAzavu7lRQPAi--SFecOg2FE6f0WlDyTPE",
  authDomain: "matriculas-madeinsertao.firebaseapp.com",
  projectId: "matriculas-madeinsertao",
  storageBucket: "matriculas-madeinsertao.appspot.com",
  messagingSenderId: "426884127493",
  appId: "1:426884127493:web:7c83d74f972af209c8b56c",
  measurementId: "G-V2DH0RHXEE"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);

function slugify(s){
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
function toast(msg){ alert(msg); }

function handleFsError(err){
  console.error(err);
  const code = err?.code || err?.message || "";
  if (code.includes("permission-denied")) {
    toast("Erro: permissão insuficiente. Entre com uma conta de administrador.");
  } else if (code.includes("unauthenticated")) {
    toast("Erro: sessão não autenticada. Faça login novamente.");
  } else {
    toast("Erro: " + (err?.message || "não foi possível concluir a ação."));
  }
}

/* ---------- UI refs ---------- */
const form        = $("#formOficina");
const inpId       = $("#oficinaId");
const inpNome     = $("#nomeOficina");
const inpCap      = $("#capacidade");
const btnSalvar   = $("#btnSalvar");
const btnCancelar = $("#btnCancelar");
const tbody       = $("#tabelaOficinas tbody");

/* ---------- Auth guard ---------- */
let unsubscribeOficinas = null;

auth.onAuthStateChanged((user)=>{
  if (!user) {
    location.href = "login.html";
    return;
  }
  if (!unsubscribeOficinas) {
    unsubscribeOficinas = listenOficinas();
  }
});

$("#btnLogout")?.addEventListener("click", ()=> auth.signOut());

/* ---------- Listagem em tempo real ---------- */
function listenOficinas(){
  return db.collection("oficinas").orderBy("nome").onSnapshot((snap)=>{
    const rows = [];
    snap.forEach((d)=>{
      const ofi   = { id: d.id, ...d.data() };
      const cap   = Number(ofi.capacidade || 0);
      const ins   = Number(ofi.inscritos  || 0);
      const vagas = Math.max(0, cap - ins);
      rows.push(`
        <tr data-id="${ofi.id}">
          <td>${ofi.nome}</td>
          <td>${cap}</td>
          <td>${ins}</td>
          <td>${vagas}</td>
          <td class="td-actions">
            <button class="btn xs btn-edit" data-action="edit">Editar</button>
            <button class="btn xs" data-action="del">Excluir</button>
          </td>
        </tr>
      `);
    });
    tbody.innerHTML = rows.join("") || `<tr><td colspan="5">Nenhuma oficina cadastrada.</td></tr>`;
  }, handleFsError);
}

/* ---------- Salvar (criar/atualizar) ---------- */
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    const nome = inpNome.value.trim();
    let cap    = Number(inpCap.value);
    if (!nome) throw new Error("Informe o nome da oficina.");
    if (!Number.isFinite(cap)) cap = 0;
    if (cap < 1) throw new Error("Capacidade mínima é 1 vaga.");

    const editingId = inpId.value.trim();

    btnSalvar.disabled = true;
    btnSalvar.textContent = editingId ? "Atualizando..." : "Salvando...";

    if (editingId) {
      await db.collection("oficinas").doc(editingId).update({
        nome, capacidade: cap
      });
      toast("Oficina atualizada.");
    } else {
      const id = slugify(nome);
      if (!id) throw new Error("Nome inválido.");
      const docRef = db.collection("oficinas").doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists) throw new Error("Já existe uma oficina com esse nome.");
      await docRef.set({ nome, capacidade: cap, inscritos: 0 });
      toast("Oficina criada.");
    }

    // Limpa form
    inpId.value = ""; inpNome.value = ""; inpCap.value = "";
    btnCancelar.style.display = "none";
    btnSalvar.textContent = "Salvar";
  }catch(err){
    handleFsError(err);
  }finally{
    btnSalvar.disabled = false;
    if (!inpId.value) btnSalvar.textContent = "Salvar";
  }
});

/* ---------- Editar/Excluir ---------- */
tbody?.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;

  const tr = btn.closest("tr");
  const id = tr?.getAttribute("data-id");
  if(!id) return;

  const action = btn.getAttribute("data-action");

  if(action === "edit"){
    try{
      const docSnap = await db.collection("oficinas").doc(id).get();
      if(!docSnap.exists){ toast("Oficina não encontrada."); return; }
      const d = docSnap.data();
      inpId.value = id;
      inpNome.value = d.nome || "";
      inpCap.value = d.capacidade || 1;
      btnSalvar.textContent = "Atualizar";
      btnCancelar.style.display = "inline-flex";
    }catch(err){
      handleFsError(err);
    }
  }

  if(action === "del"){
    try{
      const docSnap = await db.collection("oficinas").doc(id).get();
      if(!docSnap.exists){ toast("Oficina não encontrada."); return; }
      const ins = Number(docSnap.data().inscritos || 0);
      if(ins > 0){ toast("Não é possível excluir: já existem inscritos."); return; }

      if(confirm("Tem certeza que deseja excluir esta oficina?")){
        await db.collection("oficinas").doc(id).delete();
        toast("Oficina excluída.");
      }
    }catch(err){
      handleFsError(err);
    }
  }
});

btnCancelar?.addEventListener("click", ()=>{
  inpId.value = ""; inpNome.value = ""; inpCap.value = "";
  btnSalvar.textContent = "Salvar";
  btnCancelar.style.display = "none";
});

/* ---------- Menu mobile opcional ---------- */
$("#menuToggle")?.addEventListener("click", ()=>{
  document.body.classList.toggle("sidebar-open");
});