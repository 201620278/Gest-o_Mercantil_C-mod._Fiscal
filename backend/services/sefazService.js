const fs = require('fs');
const https = require('https');
const axios = require('axios');
const certificadoService = require('./certificadoService');

function criarAgent(certificado) {
  const ca = fs.readFileSync('./backend/certificados/ICP-Brasilv5.crt');

  return new https.Agent({
    cert: certificado.pemCert,
    key: certificado.pemKey,
    ca: ca,
    rejectUnauthorized: true,
    keepAlive: false,
    minVersion: 'TLSv1.2'
  });
}

function montarSoapAutorizacao(xmlAssinado) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>23</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${xmlAssinado}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function getUrls(ambiente) {
  return ambiente === 'producao'
    ? {
        autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
      }
    : {
        autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
      };
}

function montarSoapConsultaRecibo(nRec) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <cUF>23</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <tpAmb>1</tpAmb>
      <nRec>${nRec}</nRec>
    </consReciNFe>
  </soap12:Body>
</soap12:Envelope>`;
}

async function consultarRecibo(nRec, ambiente, certificadoPath, certificadoSenha) {
  const urls = getUrls(ambiente);
  const certificado = certificadoService.carregarCertificadoSalvo(
    certificadoPath,
    certificadoSenha
  );
  const agent = criarAgent(certificado);
  const soapXml = montarSoapConsultaRecibo(nRec);

  const response = await axios.post(urls.autorizacao, soapXml, {
    httpsAgent: agent,
    timeout: 180000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'Accept': 'application/soap+xml, text/xml, */*',
      'User-Agent': 'NodeJS-NFCe'
    }
  });

  const xmlRetorno = response.data;
  return {
    codigo: extrairCodigo(xmlRetorno),
    mensagem: extrairMotivo(xmlRetorno),
    protocolo: extrairProtocolo(xmlRetorno),
    recibo: extrairRecibo(xmlRetorno),
    dataAutorizacao: extrairDataAutorizacao(xmlRetorno),
    xmlRetorno
  };
}

function parseTag(xml, tag) {
  const regex = new RegExp(
    `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    'i'
  );

  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extrairCodigo(xml) {
  return parseTag(xml, 'cStat') || '0';
}

function extrairMotivo(xml) {
  return (
    parseTag(xml, 'xMotivo') ||
    parseTag(xml, 'xMensagem') ||
    parseTag(xml, 'xText') ||
    parseTag(xml, 'Text') ||
    'Retorno desconhecido'
  );
}

function extrairProtocolo(xml) {
  return parseTag(xml, 'nProt') || null;
}

function extrairRecibo(xml) {
  return parseTag(xml, 'nRec') || null;
}

function extrairDataAutorizacao(xml) {
  return parseTag(xml, 'dhRecbto') || null;
}

async function transmitirNfce(xmlAssinado, ambiente, certificadoPath, certificadoSenha) {
  const certificado = certificadoService.carregarCertificadoSalvo(
    certificadoPath,
    certificadoSenha
  );

  const agent = criarAgent(certificado);
  const urls = getUrls(ambiente);
  const soapXml = montarSoapAutorizacao(xmlAssinado);

  try {
    const response = await axios.post(urls.autorizacao, soapXml, {
      httpsAgent: agent,
      timeout: 180000,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Accept': 'application/soap+xml, text/xml, */*',
        'User-Agent': 'Node-NFCe',
        'Content-Length': Buffer.byteLength(soapXml, 'utf8')
      }
    });

    return {
      xmlRetorno: response.data
    };

  } catch (error) {
    console.error('ERRO SEFAZ COMPLETO:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });

    if (error.code === 'ECONNRESET') {
      throw new Error('Falha de conexão SVRS (ECONNRESET). Possível TLS/endpoint.');
    }

    throw error;
  }
}

module.exports = { transmitirNfce };
