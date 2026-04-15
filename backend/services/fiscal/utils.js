const crypto = require('crypto');

function onlyDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function padLeft(value, size, char = '0') {
  return String(value == null ? '' : value).padStart(size, char);
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatNumber(value, decimals = 2) {
  return Number(value || 0).toFixed(decimals);
}

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = padLeft(d.getMonth() + 1, 2);
  const dd = padLeft(d.getDate(), 2);
  return `${yyyy}-${mm}-${dd}`;
}

function nowDhEmi() {
  return new Date().toISOString();
}

// Módulo 11 da chave NF-e/NFC-e
function modulo11(base) {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    soma += Number(base[i]) * peso;
    peso += 1;
    if (peso > 9) peso = 2;
  }
  const resto = soma % 11;
  return (resto === 0 || resto === 1) ? 0 : 11 - resto;
}

function gerarCodigoNumerico() {
  return padLeft(Math.floor(Math.random() * 99999999), 8);
}

function gerarChaveAcesso({ uf, aamm, cnpj, modelo = '65', serie, numero, tpEmis = '1', cNF }) {
  const base = [
    padLeft(uf, 2),
    aamm,
    padLeft(onlyDigits(cnpj), 14),
    padLeft(modelo, 2),
    padLeft(serie, 3),
    padLeft(numero, 9),
    padLeft(tpEmis, 1),
    padLeft(cNF, 8)
  ].join('');
  const dv = modulo11(base);
  return `${base}${dv}`;
}

function sha1Hex(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  onlyDigits,
  padLeft,
  round2,
  formatNumber,
  todayYMD,
  nowDhEmi,
  gerarCodigoNumerico,
  gerarChaveAcesso,
  sha1Hex,
  xmlEscape
};
