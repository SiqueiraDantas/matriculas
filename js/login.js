document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value.trim();
  const erro = document.getElementById('erro');

  if (usuario === 'admamm' && senha === 'amm@2025') {
    localStorage.setItem('usuarioLogado', 'true');
    window.location.href = 'index.html';
  } else {
    erro.textContent = 'Usuário ou senha inválidos!';
  }
});

// Em qualquer página protegida (ex: inicio.html), adicione esse script:
if (window.location.pathname.includes('index.html') && localStorage.getItem('usuarioLogado') !== 'true') {
  window.location.href = 'login.html';
}
