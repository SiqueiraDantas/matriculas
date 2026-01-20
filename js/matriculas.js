// js/matriculas.js — formulário público (OFICINAS FIXAS no HTML + PCD + upload)
// Versão "conservadora": sem optional chaining, sem template strings

// ============== Firebase compat ==============
var firebaseConfig = {
  apiKey: "AIzaSyB79TFuSXVbYprURdw5Q5jI9xxc6DkDOMQ",
  authDomain: "matriculas-cfdd0.firebaseapp.com",
  projectId: "matriculas-cfdd0",
  storageBucket: "matriculas-cfdd0.appspot.com", // compat
  messagingSenderId: "697940252168",
  appId: "1:697940252168:web:0822cc5e1e94b083dde3bd",
  measurementId: "G-ZBPXGL357R"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

var db = null;
try { db = firebase.firestore(); } catch (e) { console.warn("Firestore não disponível:", e); }

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
  }, 7000);
}

function humanFirestoreError(err) {
  var msg = (err && err.message) ? err.message : "Erro desconhecido.";
  var code = (err && err.code) ? String(err.code) : "";

  // Permissões (regras)
  if (code.indexOf("permission-denied") !== -1 || msg.indexOf("Missing or insufficient permissions") !== -1) {
    return "Permissão negada no Firestore. Ajuste as regras do Firestore para permitir o envio do formulário público.";
  }

  // Índice composto
  if (code.indexOf("failed-precondition") !== -1 || msg.indexOf("requires an index") !== -1) {
    return "Faltando índice no Firestore para essa consulta (ano + escola). Abra o link que aparece no console/erro e crie o índice automaticamente.";
  }

  // Firestore não criado/ativado
  if (msg.indexOf("The Cloud Firestore API is not available") !== -1 ||
      msg.indexOf("Cloud Firestore has not been used") !== -1) {
    return "O Firestore não está ativado no projeto. Vá no Firebase Console e crie/ative o Firestore Database.";
  }

  return msg;
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

// ======= Padronização de nomes (Aluno/Responsável) =======
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
  if (base === "jr" || base === "neto" || base === "filho") {
    return capitalizeWord(base);
  }
  return capitalizeWord(base);
}

function formatToken(token, isFirstWord) {
  var aposMatch = token.match(/^([a-zçãõâêîôûáéíóúàèìòùäëïöüñ]+[’'])(.+)$/i);
  if (aposMatch) {
    var partA = aposMatch[1].toLocaleLowerCase("pt-BR");
    var partB = capitalizeWord(aposMatch[2]);
    return partA + partB;
  }
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

// ======= Validação de idade (8 a 18) =======
function idadeValidaStr(val) {
  if (val === null || val === undefined) return false;
  var n = Number(String(val).trim());
  if (isNaN(n)) return false;
  return n >= 8 && n <= 18;
}

function mostrarErroIdade(mostrar) {
  var el = document.getElementById("erroIdade");
  if (!el) return;
  el.style.display = mostrar ? "block" : "none";
}

// ============== Main submit ==============
window.addEventListener("DOMContentLoaded", function () {
  wirePCDToggle();

  // Padronização de nomes
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

  // Feedback de idade inválida
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

    // Checagens básicas de SDK
    if (!db) {
      notify("❗ Firestore não carregou. Verifique se firebase-firestore.js está incluído no HTML.", true);
      return;
    }

    // Valida idade
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

        // Oficinas fixas no HTML
        var escolhidas = [];
        var ofEls = document.querySelectorAll('input[name="oficinas[]"]:checked');
        for (var j = 0; j < ofEls.length; j++) escolhidas.push({ id: null, nome: ofEls[j].value });

        if (escolhidas.length === 0) {
          notify("❗ Selecione pelo menos uma oficina.", true);
          return;
        }

        // PCD
        var pcd = (getCheckedRad("pcd") || "Não").toString();
        var pcdInput = document.getElementById("pcdArquivo");
        var pcdArquivoUrl = null, pcdArquivoNome = null, pcdArquivoPath = null;

        if (pcd === "Sim") {
          if (!storage) { notify("❗ Upload PCD indisponível (Storage não carregou no HTML).", true); return; }
          var file = pcdInput && pcdInput.files && pcdInput.files[0];
          var v = validatePCDFile(file);
          if (!v.ok) { notify("❗ Arquivo PCD inválido: " + v.reason, true); return; }

          var safeName = String(file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
          var path = "pcd_comprovantes/" + (cpf || "semcpf") + "_" + Date.now() + "_" + safeName;

          var ref = storage.ref(path);
          await ref.put(file);
          pcdArquivoUrl = await ref.getDownloadURL();
          pcdArquivoNome = file.name;
          pcdArquivoPath = path;
        }

        // Validações essenciais
        if (!nome) { notify("❗ Informe o nome do aluno.", true); return; }
        if (!validarCPF(cpf)) { notify("❗ CPF inválido.", true); return; }
        if (!escola) { notify("❗ Selecione a escola.", true); return; }
        if (!tipoMatricula) { notify("❗ Selecione Matrícula (A) ou Rematrícula (B).", true); return; }
        if (!responsavel.nome || !responsavel.telefone) { notify("❗ Informe os dados do responsável.", true); return; }

        // Coleção
        var COL = "matriculas";

        // Duplicidade por CPF
        var dup = await db.collection(COL).where("cpf","==",cpf).get();
        if (!dup.empty) { notify("❗ CPF já cadastrado.", true); return; }

        // Número de matrícula (dinâmico por ano/escola)
        var ano = (new Date()).getFullYear();
        var ce  = codEscola(escola);

        // OBS: isso pode exigir ÍNDICE COMPOSTO (ano + escola). Se exigir, o erro trará um link.
        var seqSnap = await db.collection(COL)
          .where("ano","==",ano)
          .where("escola","==",escola)
          .get();

        var numeroMatricula = ano + "-" + tipoMatricula + "-" + ce + "-" + String(seqSnap.size + 1).padStart(4,"0");

        // Payload
        var now = new Date();
        var alunoRef = db.collection(COL).doc();

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
          programas: programas,
          pcd: pcd,
          pcdArquivoUrl: pcdArquivoUrl,
          pcdArquivoNome: pcdArquivoNome,
          pcdArquivoPath: pcdArquivoPath,
          responsavel: responsavel,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          dataEnvio: now.toISOString()
        };

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
        notify("❌ " + humanFirestoreError(err), true);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Enviar Matrícula"; }
      }
    })();
  });
});