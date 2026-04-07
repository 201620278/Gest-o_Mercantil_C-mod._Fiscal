const https = require('https');

function transmitirNfce(xmlAssinado, ambiente) {
  return new Promise((resolve) => {
    const dataAutorizacao = new Date().toISOString();
    const protocolo = `1${Math.floor(Math.random() * 900000000) + 100000000}`;
    const codigo = '100';
    const mensagem = ambiente === 'producao'
      ? 'Autorizado o uso da NFC-e em ambiente de produção'
      : 'Autorizado o uso da NFC-e em ambiente de homologação';

    const xmlRetorno = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<retEnviNFe>\n` +
      `  <infRec>\n` +
      `    <nRec>${protocolo}</nRec>\n` +
      `    <dhRecbto>${dataAutorizacao}</dhRecbto>\n` +
      `    <tMed>1</tMed>\n` +
      `  </infRec>\n` +
      `  <protNFe>\n` +
      `    <infProt>\n` +
      `      <tpAmb>${ambiente === 'producao' ? 1 : 2}</tpAmb>\n` +
      `      <verAplic>1.0</verAplic>\n` +
      `      <chNFe></chNFe>\n` +
      `      <dhRecbto>${dataAutorizacao}</dhRecbto>\n` +
      `      <nProt>${protocolo}</nProt>\n` +
      `      <digVal>ASSINATURA_PLACEHOLDER</digVal>\n` +
      `      <cStat>${codigo}</cStat>\n` +
      `      <xMotivo>${mensagem}</xMotivo>\n` +
      `    </infProt>\n` +
      `  </protNFe>\n` +
      `</retEnviNFe>`;

    // Simulação de transmissão para próxima etapa de integração
    resolve({
      codigo,
      mensagem,
      protocolo,
      dataAutorizacao,
      xmlRetorno
    });
  });
}

module.exports = { transmitirNfce };
