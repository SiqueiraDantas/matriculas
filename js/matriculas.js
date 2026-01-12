// js/matriculas.js — formulário público (oficinas dinâmicas + PCD + upload + transação de vagas)
// Versão "conservadora": sem optional chaining, sem template strings

// ============== Firebase compat ==============
var firebaseConfig = {
  apiKey: "AIzaSyAzavu7lRQPAi--SFecOg2FE6f0WlDyTPE",
  authDomain: "matriculas-madeinsertao.firebaseapp.com",
  projectId: "matriculas-madeinsertao",
  storageBucket: "matriculas-madeinsertao.appspot.com",
  messagingSenderId: "426884127493",
  appId: "1:426884127493:web:7c83d74f972af209c8b56c",
  measurementId: "G-V2DH0RHXEE"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var storage = null;
try { storage = firebase.storage(); } catch (e) { console.warn("Storage não disponível:", e); }

// ============== Helpers UI/Validação ==============
function notify(msg, isErr) {
  if (isErr === void 0) isErr = false;
  var n = document.getElementById("notificacao");
  if (!n) { alert(msg); return; }
  n.textContent = msg;
  n.style.position = "fixed";
  n.style.top = "20px";
  n.style.left = "50%";
  n.style.transform = "translateX(-50%)";
  n.style.padding = "12px 24px";
  n.style.borderRadius = "10px";
  n.style.color = "#fff";
  n.style.fontWeight = "600";
  n.style.fontSize = "16px";
  n.style.background = isErr ? "#c0392b" : "#27ae60";
  n.style.zIndex = "10000";
  n.style.boxShadow = "0 4px 12px rgba(0,0,0,.2)";
  setTimeout(function () {
    n.textContent = "";
    n.removeAttribute("style");
  }, 6000);
}

function validarCPF(cpf) {
  if (!cpf) return false;
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  var s = 0, i, r;
  for (i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0; if (r !== +cpf[9]) return false;
  s = 0; for (i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0; return r === +cpf[10];
}

function codEscola(nome) {
  var c = {
    "Escola de Ensino Infantil e Fundamental Maria do Carmo": "MC",
    "Escola de Ensino Médio Alfredo Machado": "AM",
    "CEI Mãe Toinha": "MT",
    "CEI Sara Rosita": "SR",
    "CEI Raio de Luz": "RL",
    "CEI Pequeno Aprendiz": "PA",
    "CEI Criança Feliz": "CF",
    "CEI Luz do Saber": "LS",
    "CEI Mundo Encantado": "ME",
    "CEI Sonho de Criança": "SC",
    "CEI José Edson do Nascimento": "JE",
    "CEI José Alzir Silva Lima": "JA"
  };
  return c[nome] || "EMM";
}

function sanitizeCPF(cpf) { return (cpf || "").replace(/\D/g, ""); }

function getCheckedRad(name) {
  var el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

function validatePCDFile(file) {
  if (!file) return { ok:false, reason:"Nenhum arquivo selecionado." };
  var types = ["application/pdf","image/jpeg","image/png"];
  if (types.indexOf(file.type) === -1) return { ok:false, reason:"Tipo inválido. Use PDF/JPG/PNG." };
  if (file.size > 5 * 1024 * 1024) return { ok:false, reason:"Máximo 5MB." };
  return { ok:true };
}

// ======= NOVO: Padronização de nomes (Aluno/Responsável) =======
var PARTICULAS_MINUSCULAS = [
  "da","das","de","do","dos","e","di","du","della","dello","del","der",
  "van","von","la","le","y"
];

function removeDiacritics(str) {
  return (str || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function capitalizeWord(w) {
  if (!w) return "";
  return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1);
}

function applyWordRules(word, isFirstWord) {
  var base = (word || "").toLocaleLowerCase("pt-BR");
  if (!isFirstWord && PARTICULAS_MINUSCULAS.indexOf(removeDiacritics(base)) !== -1) {
    return base;
  }
  // Alguns sufixos comuns (ajuste se quiser outro comportamento)
  if (base === "jr" || base === "neto" || base === "filho") {
    return capitalizeWord(base);
  }
  return capitalizeWord(base);
}

function formatToken(token, isFirstWord) {
  // d'Ávila / d’Almeida
  var aposMatch = token.match(/^([a-zçãõâêîôûáéíóúàèìòùäëïöüñ]+[’'])(.+)$/i);
  if (aposMatch) {
    var partA = aposMatch[1].toLocaleLowerCase("pt-BR");
    var partB = capitalizeWord(aposMatch[2]);
    return partA + partB;
  }
  // Ana-Clara
  if (token.indexOf("-") !== -1) {
    var subs = token.split("-");
    for (var i = 0; i < subs.length; i++) {
      subs[i] = applyWordRules(subs[i], isFirstWord && i === 0);
    }
    return subs.join("-");
  }
  return applyWordRules(token, isFirstWord);
}

function toTitleCasePtBr(nome) {
  if (!nome) return "";
  var clean = nome.replace(/\s+/g, " ").trim();
  clean = clean.toLocaleLowerCase("pt-BR");
  var palavras = clean.split(" ");
  for (var i = 0; i < palavras.length; i++) {
    palavras[i] = formatToken(palavras[i], i === 0);
  }
  return palavras.join(" ");
}

// ============== Oficinas em tempo real (DOM puro) ==============
var oficinasGroup = document.getElementById("oficinasGroup");

function listenOficinas() {
  if (!oficinasGroup) {
    console.warn("oficinasGroup não encontrado.");
    return;
  }
  console.log("[Matriculas] listenOficinas: iniciando…");

  return db.collection("oficinas").orderBy("nome").onSnapshot(function (snap) {
    console.log("[Matriculas] oficinas snapshot size:", snap.size);
    oficinasGroup.innerHTML = "";

    if (snap.empty) {
      oficinasGroup.innerHTML = "<small class='help'>Nenhuma oficina cadastrada ainda.</small>";
      return;
    }

    snap.forEach(function (doc) {
      var ofi = doc.data();
      var id = doc.id;

      // label.chip
      var label = document.createElement("label");
      label.className = "chip";

      // input checkbox
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "oficinas[]";
      input.value = ofi && ofi.nome ? ofi.nome : "(sem nome)";
      input.setAttribute("data-id", id);

      // texto (SEM vagas / SEM lotação)
      var texto = (ofi && ofi.nome ? ofi.nome : "(sem nome)");

      label.appendChild(input);
      label.appendChild(document.createTextNode(texto));
      oficinasGroup.appendChild(label);
    });
  }, function (err) {
    console.error("listenOficinas erro:", err);
    oficinasGroup.innerHTML = "<small class='help' style='color:#c0392b'>Falha ao carregar oficinas.</small>";
  });
}

// ============== PCD Toggle/Upload ==============
function wirePCDToggle() {
  var group = document.getElementById("pcdGroup");
  var wrap  = document.getElementById("pcdUploadWrap");
  var input = document.getElementById("pcdArquivo");
  var label = document.getElementById("pcdArquivoNome");

  if (group) {
    group.addEventListener("change", function () {
      var val = getCheckedRad("pcd");
      var show = val === "Sim";
      if (wrap) {
        if (show) wrap.classList.remove("hidden");
        else wrap.classList.add("hidden");
      }
      if (!show && input) {
        input.value = "";
        if (label) label.textContent = "";
      }
    });
  }

  if (input) {
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (label) label.textContent = f ? ("Selecionado: " + f.name) : "";
    });
  }
}

// ======= NOVO: Validação de idade =======
function idadeValidaStr(val) {
  if (val === null || val === undefined) return false;
  var n = Number(String(val).trim());
  if (isNaN(n)) return false;
  // ALTERADO: 8 a 18
  return n >= 8 && n <= 18;
}

function mostrarErroIdade(mostrar) {
  var el = document.getElementById("erroIdade");
  if (!el) return;
  el.style.display = mostrar ? "block" : "none";
}

// ============== Main submit (SEM transação de vagas) ==============
window.addEventListener("DOMContentLoaded", function () {
  wirePCDToggle();
  listenOficinas();

  // NOVO: padronização de nomes ao sair do campo
  var inputNome = document.getElementById("nome");
  var inputResponsavel = document.getElementById("responsavel");
  if (inputNome) {
    inputNome.addEventListener("blur", function () {
      inputNome.value = toTitleCasePtBr(inputNome.value);
    });
  }
  if (inputResponsavel) {
    inputResponsavel.addEventListener("blur", function () {
      inputResponsavel.value = toTitleCasePtBr(inputResponsavel.value);
    });
  }

  // NOVO: feedback de idade inválida enquanto digita
  var inputIdade = document.getElementById("idade");
  if (inputIdade) {
    inputIdade.addEventListener("input", function () {
      var ok = idadeValidaStr(inputIdade.value);
      var temValor = String(inputIdade.value || "").trim() !== "";
      mostrarErroIdade(!ok && temValor);
    });
    inputIdade.addEventListener("blur", function () {
      var ok = idadeValidaStr(inputIdade.value);
      var temValor = String(inputIdade.value || "").trim() !== "";
      mostrarErroIdade(!ok && temValor);
    });
  }

  var form = document.getElementById("formMatricula");
  var btn  = document.getElementById("btnEnviar");

  if (!form) {
    console.error("Form #formMatricula não encontrado.");
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // NOVO: valida idade (bloqueia envio se fora da faixa)
    var idadeEl = document.getElementById("idade");
    var idadeOk = idadeEl ? idadeValidaStr(idadeEl.value) : false;
    if (!idadeOk) {
      mostrarErroIdade(true);
      if (idadeEl) idadeEl.focus();
      notify("❗ A idade deve estar entre 8 e 18 anos.", true);
      return;
    } else {
      mostrarErroIdade(false);
    }

    if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

    (async function () {
      try {
        var fd = new FormData(form);

        // Aluno
        var nome   = (fd.get("nome") || "").toString().trim();
        var cpfRaw = (fd.get("cpf") || "").toString();
        var cpf    = sanitizeCPF(cpfRaw);
        var idade  = (fd.get("idade") || "").toString().trim();
        var sexo   = (fd.get("sexo") || "").toString();
        var raca   = (fd.get("raca") || "").toString();
        var religiao = (fd.get("religiao") || "").toString();
        var escola   = (fd.get("escola") || "").toString();
        var bairro   = (fd.get("bairro") || "").toString();
        var rede     = (fd.get("rede") || "").toString();
        var tipoMatricula = (fd.get("tipoMatricula") || "").toString();
        var telefoneAluno = (fd.get("telefoneAluno") || fd.get("telefone") || "").toString().trim();

        // NOVO: padroniza nomes antes de salvar
        if (nome) nome = toTitleCasePtBr(nome);

        // Responsável
        var responsavel = {
          nome: (fd.get("responsavel") || "").toString().trim(),
          telefone: (fd.get("telefoneResponsavel") || "").toString().trim(),
          email: (fd.get("email") || "").toString().trim(),
          integrantes: (fd.get("integrantes") || "").toString()
        };
        if (responsavel.nome) responsavel.nome = toTitleCasePtBr(responsavel.nome);

        // Programas
        var programas = [];
        var progEls = document.querySelectorAll('input[name="programas[]"]:checked');
        for (var i = 0; i < progEls.length; i++) programas.push(progEls[i].value);

        // Oficinas escolhidas (id + nome)
        var escolhidas = [];
        var ofEls = document.querySelectorAll('input[name="oficinas[]"]:checked');
        for (var j = 0; j < ofEls.length; j++) {
          escolhidas.push({ id: ofEls[j].getAttribute("data-id"), nome: ofEls[j].value });
        }
        if (escolhidas.length === 0) { notify("❗ Selecione pelo menos uma oficina.", true); throw new Error("Selecione pelo menos uma oficina."); }

        // PCD
        var pcd = (getCheckedRad("pcd") || "Não").toString();
        var pcdInput = document.getElementById("pcdArquivo");
        var pcdArquivoUrl = null, pcdArquivoNome = null, pcdArquivoPath = null;
        if (pcd === "Sim") {
          if (!storage) { notify("❗ Upload PCD indisponível (Storage não carregado).", true); return; }
          var file = pcdInput && pcdInput.files && pcdInput.files[0];
          var v = validatePCDFile(file);
          if (!v.ok) { notify("❗ Arquivo PCD inválido: " + v.reason, true); return; }
          var path = "pcd_comprovantes/" + (cpf || "semcpf") + "_" + Date.now() + "_" + file.name;
          var ref = storage.ref(path);
          await ref.put(file);
          pcdArquivoUrl = await ref.getDownloadURL();
          pcdArquivoNome = file.name;
          pcdArquivoPath = path;
        }

        // Validações essenciais
        if (!nome) throw new Error("Informe o nome do aluno.");
        if (!validarCPF(cpf)) { notify("❗ CPF inválido.", true); return; }
        if (!escola) throw new Error("Selecione a escola.");
        if (!tipoMatricula) throw new Error("Selecione Matrícula (A) ou Rematrícula (B).");
        if (!responsavel.nome || !responsavel.telefone) throw new Error("Informe os dados do responsável.");

        // Duplicidade por CPF
        var dup = await db.collection("matriculas").where("cpf","==",cpf).get();
        if (!dup.empty) { notify("❗ CPF já cadastrado.", true); return; }

        // Número de matrícula (dinâmico por ano/escola)
        var ano = (new Date()).getFullYear();
        var ce  = codEscola(escola);
        var seq = await db.collection("matriculas").where("ano","==",ano).where("escola","==",escola).get();
        var numeroMatricula = ano + "-" + tipoMatricula + "-" + ce + "-" + String(seq.size + 1).padStart(4,"0");

        // Payload base
        var now = new Date();
        var alunoRef = db.collection("matriculas").doc(); // id manual
        var payload = {
          numeroMatricula: numeroMatricula,
          ano: ano,
          nome: nome,
          cpf: cpf,
          idade: idade,
          sexo: sexo,
          raca: raca,
          religiao: religiao,
          escola: escola,
          bairro: bairro,
          rede: rede,
          tipoMatricula: tipoMatricula,
          telefoneAluno: telefoneAluno,
          oficinas: escolhidas.map(function(o){ return o.nome; }),
          oficinaIds: escolhidas.map(function(o){ return o.id; }),
          programas: programas,
          pcd: pcd,
          pcdArquivoUrl: pcdArquivoUrl,
          pcdArquivoNome: pcdArquivoNome,
          pcdArquivoPath: pcdArquivoPath,
          responsavel: responsavel,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          dataEnvio: now.toISOString()
        };

        // ALTERADO: sem transação de vagas / sem debitar inscritos
        await alunoRef.set(payload);

        notify(nome + ", sua matrícula foi efetuada com sucesso!");
        form.reset();
        var wrap = document.getElementById("pcdUploadWrap");
        var nomeEl = document.getElementById("pcdArquivoNome");
        if (wrap) wrap.classList.add("hidden");
        if (nomeEl) nomeEl.textContent = "";
        window.scrollTo(0, 0);
      } catch (err) {
        console.error(err);
        notify("❌ " + (err && err.message ? err.message : "Não foi possível enviar a matrícula."), true);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Enviar Matrícula"; }
      }
    })();
  });
});
