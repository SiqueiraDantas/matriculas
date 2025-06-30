// Firebase config
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

const form = document.getElementById('formMatricula');
const btnEnviar = form.querySelector('button[type="submit"]');
const notificacao = document.getElementById('notificacao');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  const formData = new FormData(form);

  const nome = formData.get('nome')?.trim();
  const cpf = formData.get('cpf')?.replace(/\D/g, '');
  const idade = formData.get('idade')?.trim();
  const sexo = formData.get('sexo');
  const raca = formData.get('raca');
  const religiao = formData.get('religiao');
  const escola = formData.get('escola');
  const rede = formData.get('rede');
  const bairro = formData.get('bairro');
  const tipoMatricula = formData.get('tipoMatricula');

  const oficinas = formData.getAll('oficinas[]');
  const programas = formData.getAll('programas[]');

  const responsavel = {
    nome: formData.get('responsavel')?.trim(),
    telefone: formData.get('telefone')?.trim(),
    email: formData.get('email')?.trim(),
    integrantes: formData.get('integrantes') || '',
  };

  // Validação de CPF
  if (!validarCPF(cpf)) {
    exibirNotificacao("❗ CPF inválido. Por favor, verifique e tente novamente.", true);
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Matrícula';
    return;
  }

  try {
    const existente = await db.collection("matriculas").where("cpf", "==", cpf).get();

    if (!existente.empty) {
      exibirNotificacao("❗ Sua matrícula já foi realizada. O CPF informado já está cadastrado.", true);
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar Matrícula';
      return;
    }

    const anoFixo = 2025;
    const codigoEscola = gerarCodigoEscola(escola);

    const querySnapshot = await db.collection("matriculas")
      .where("ano", "==", anoFixo)
      .where("escola", "==", escola)
      .get();

    const contador = querySnapshot.size + 1;
    const sequencial = String(contador).padStart(4, '0');
    const numeroMatricula = `${anoFixo}-${tipoMatricula}-${codigoEscola}-${sequencial}`;

    await db.collection("matriculas").add({
      numeroMatricula,
      ano: anoFixo,
      nome,
      cpf,
      idade,
      sexo,
      raca,
      religiao,
      escola,
      bairro,
      rede,
      tipoMatricula,
      oficinas,
      programas,
      responsavel,
      dataEnvio: new Date().toISOString()
    });

    exibirNotificacao(`${nome}, sua matrícula foi efetuada com sucesso!`);
    form.reset();
  } catch (erro) {
    console.error("Erro ao enviar matrícula:", erro);
    exibirNotificacao("❌ Erro ao enviar matrícula. Tente novamente mais tarde.", true);
  }

  btnEnviar.disabled = false;
  btnEnviar.textContent = 'Enviar Matrícula';
});

function gerarCodigoEscola(nomeEscola) {
  const codigos = {
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

  return codigos[nomeEscola] || "EMM";
}

function exibirNotificacao(mensagem, erro = false) {
  notificacao.textContent = mensagem;
  notificacao.style.position = 'fixed';
  notificacao.style.top = '20px';
  notificacao.style.left = '50%';
  notificacao.style.transform = 'translateX(-50%)';
  notificacao.style.padding = '12px 24px';
  notificacao.style.borderRadius = '10px';
  notificacao.style.color = '#fff';
  notificacao.style.fontWeight = '600';
  notificacao.style.fontSize = '16px';
  notificacao.style.backgroundColor = erro ? '#c0392b' : '#27ae60';
  notificacao.style.zIndex = '10000';
  notificacao.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  notificacao.style.maxWidth = '90%';
  notificacao.style.textAlign = 'center';

  setTimeout(() => {
    notificacao.textContent = '';
    notificacao.removeAttribute('style');
  }, 6000);
}

function validarCPF(cpf) {
  if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.charAt(10));
}
