// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAzavu7lRQPAi--SFecOg2FE6f0WlDyTPE",
  authDomain: "matriculas-madeinsertao.firebaseapp.com",
  projectId: "matriculas-madeinsertao",
  storageBucket: "matriculas-madeinsertao.appspot.com",
  messagingSenderId: "426884127493",
  appId: "1:426884127493:web:7c83d74f972af209c8b56c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Atualiza número total de alunos
db.collection("matriculas").get().then(snapshot => {
  const total = snapshot.size;
  document.querySelector("#totalInscritosCard .numero").textContent = total;
}).catch(error => {
  console.error("Erro ao contar inscritos:", error);
  document.querySelector("#totalInscritosCard .numero").textContent = "Erro";
});

// Logout
function logout() {
  localStorage.removeItem('usuarioLogado');
  window.location.href = 'login.html';
}

// Exibir tabela com os dados ao clicar no card
document.getElementById("totalInscritosCard").addEventListener("click", async () => {
  const tabela = document.getElementById("tabelaAlunos");
  const tbody = document.querySelector("#tabelaMatrículas tbody");

  if (tabela.style.display === "block") {
    tabela.style.display = "none";
    return;
  }

  tabela.style.display = "block";
  tbody.innerHTML = "<tr><td colspan='16'>🔄 Carregando dados...</td></tr>";

  try {
    const snapshot = await db.collection("matriculas").orderBy("dataEnvio", "desc").get();
    tbody.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      const linha = document.createElement("tr");

      linha.innerHTML = `
        <td>${data.numeroMatricula || '-'}</td>
        <td>${data.nome || '-'}</td>
        <td>${data.cpf || '-'}</td>
        <td>${data.idade || '-'}</td>
        <td>${data.sexo || '-'}</td>
        <td>${data.raca || '-'}</td>
        <td>${data.religiao || '-'}</td>
        <td>${data.escola || '-'}</td>
        <td>${data.rede || '-'}</td>
        <td>${data.tipoMatricula === "A" ? "Matrícula" : "Rematrícula"}</td>
        <td>${(data.oficinas || []).join(", ")}</td>
        <td>${(data.programas || []).join(", ")}</td>
        <td>${data.responsavel?.nome || '-'}</td>
        <td>${data.responsavel?.telefone || '-'}</td>
        <td>${data.responsavel?.email || '-'}</td>
        <td>${data.responsavel?.integrantes || '-'}</td>
      `;
      tbody.appendChild(linha);
    });
  } catch (erro) {
    tbody.innerHTML = `<tr><td colspan="16">❌ Erro ao carregar dados.</td></tr>`;
    console.error("Erro ao buscar matrículas:", erro);
  }
});
