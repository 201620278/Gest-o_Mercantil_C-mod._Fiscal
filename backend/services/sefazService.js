const https = require('https');
const QRCode = require('qrcode');

function transmitirNfce(xmlAssinado, ambiente) {
  return new Promise(async (resolve) => {
    const dataAutorizacao = new Date().toISOString();
    const protocolo = `1${Math.floor(Math.random() * 900000000) + 100000000}`;
    const codigo = '100';
    const mensagem = ambiente === 'producao'
      ? 'Autorizado o uso da NFC-e em ambiente de produção'
      : 'Autorizado o uso da NFC-e em ambiente de homologação';

    // Extrair chave de acesso do XML assinado (simulação)
    const chaveMatch = xmlAssinado.match(/<infNFe[^>]*Id="NFe([^"]+)"/);
    const chaveAcesso = chaveMatch ? chaveMatch[1] : 'CHAVE_SIMULADA';

    // Gerar QR Code URL (simulação baseada na chave)
    const urlConsulta = `https://www.sefaz.ce.gov.br/nfce/consulta?qrcode=${chaveAcesso}`;

    // Gerar QR Code em base64
    let qrCodeBase64 = null;
    try {
      qrCodeBase64 = await QRCode.toDataURL(urlConsulta, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      qrCodeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    }

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
      xmlRetorno,
      qrCodeUrl: urlConsulta,
      qrCodeBase64
    });
  });
}

module.exports = { transmitirNfce };
