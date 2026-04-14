const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const certificadoService = require('../certificadoService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizarXml(xml = '') {
  return String(xml)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function escaparXmlSoap(valor = '') {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extrairInnerNFeDoLote(xmlEnviNFe) {
  const xml = normalizarXml(xmlEnviNFe);

  const match = xml.match(/<NFe\b[\s\S]*<\/NFe>/);

  if (!match) {
    throw new Error('Não foi possível extrair o bloco <NFe>...</NFe> do XML de envio.');
  }

  return match[0];
}

function montarSoapAutorizacao({ cUF, dadosXmlNFe }) {
  const xmlEscapado = escaparXmlSoap(dadosXmlNFe);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <nfeCabecMsg xmlns="">
        <cUF>${cUF}</cUF>
        <versaoDados>4.00</versaoDados>
      </nfeCabecMsg>
      <nfeDadosMsg xmlns="">
        ${xmlEscapado}
      </nfeDadosMsg>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function montarSoapRetAutorizacao({ cUF, xmlConsReciNFe }) {
  const xmlEscapado = escaparXmlSoap(xmlConsReciNFe);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <nfeCabecMsg xmlns="">
        <cUF>${cUF}</cUF>
        <versaoDados>4.00</versaoDados>
      </nfeCabecMsg>
      <nfeDadosMsg xmlns="">
        ${xmlEscapado}
      </nfeDadosMsg>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function obterEndpointsNfce(ambiente = 'homologacao') {
  const ehHomologacao =
    String(ambiente).toLowerCase() === 'homologacao' ||
    String(ambiente) === '2';

  return ehHomologacao
    ? {
        autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        retAutorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx'
      }
    : {
        autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        retAutorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx'
      };
}

function montarHttpsAgentComPem({
  caminhoCertificado,
  senhaCertificado,
  caminhoCa
}) {
  const certInfo = certificadoService.carregarCertificadoSalvo(
    caminhoCertificado,
    senhaCertificado
  );

  const agentOptions = {
    key: certInfo.pemKey,
    cert: certInfo.pemCert,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.2',
    keepAlive: false,
    honorCipherOrder: true,
    rejectUnauthorized: true
  };

  if (caminhoCa) {
    const caminhoCaResolvido = path.resolve(caminhoCa);
    if (fs.existsSync(caminhoCaResolvido)) {
      agentOptions.ca = fs.readFileSync(caminhoCaResolvido);
    }
  }

  return new https.Agent(agentOptions);
}

async function parseSoapRetorno(xml) {
  const obj = await parseStringPromise(xml, {
    explicitArray: false,
    ignoreAttrs: false,
    tagNameProcessors: [name => name.replace(/^.*:/, '')]
  });

  const envelope = obj.Envelope || obj.envelope;
  const body = envelope?.Body || envelope?.body;

  if (!body) {
    return { bruto: xml, obj, ret: null };
  }

  const ret =
    body.nfeResultMsg ||
    body.nfeAutorizacaoLoteResult ||
    body.nfeAutorizacaoResult ||
    body.retEnviNFe ||
    body.retConsReciNFe ||
    body;

  return { bruto: xml, obj, ret };
}

function localizarRetornoNfe(ret) {
  if (!ret) return null;

  if (ret.retEnviNFe) return ret.retEnviNFe;
  if (ret.retConsReciNFe) return ret.retConsReciNFe;
  return ret;
}

function extrairDadosRetorno(retornoParseado) {
  const raiz = localizarRetornoNfe(retornoParseado?.ret) || {};
  const prot = raiz.protNFe?.infProt || {};
  const infRec = raiz.infRec || {};

  return {
    cStat: String(prot.cStat || raiz.cStat || ''),
    xMotivo: String(prot.xMotivo || raiz.xMotivo || ''),
    recibo: String(infRec.nRec || raiz.nRec || ''),
    protocolo: String(prot.nProt || ''),
    dataAutorizacao: String(prot.dhRecbto || ''),
    digVal: String(prot.digVal || '')
  };
}

async function consultarRecibo({
  cUF,
  tpAmb,
  nRec,
  httpsAgent,
  timeout = 60000
}) {
  const endpoints = obterEndpointsNfce(tpAmb === 2 ? 'homologacao' : 'producao');

  const xmlConsReciNFe = `<?xml version="1.0" encoding="UTF-8"?>
<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <nRec>${nRec}</nRec>
</consReciNFe>`;

  const envelope = montarSoapRetAutorizacao({
    cUF,
    xmlConsReciNFe
  });

  const response = await axios.post(endpoints.retAutorizacao, envelope, {
    httpsAgent,
    timeout,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'Accept': 'application/soap+xml, text/xml, */*',
      'Connection': 'close',
      'User-Agent': 'Mercadao-NFCe/1.0'
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: status => status >= 200 && status < 500
  });

  return parseSoapRetorno(response.data);
}

async function transmitirNfce({
  xmlEnviNFe,
  certificado,
  configuracaoFiscal,
  pastaDebug
}) {
  const caminhoCertificado = certificado?.caminho_pfx || certificado?.caminhoCertificado;
  const senhaCertificado = certificado?.senha || certificado?.senhaCertificado;
  const caminhoCa = certificado?.caminho_ca || certificado?.caminhoCa;

  if (!caminhoCertificado) {
    throw new Error('Caminho do certificado não informado.');
  }

  if (!senhaCertificado) {
    throw new Error('Senha do certificado não informada.');
  }

  const tpAmb = Number(configuracaoFiscal?.ambiente || 2);
  const cUF = String(configuracaoFiscal?.uf_codigo || '23');
  const endpoints = obterEndpointsNfce(tpAmb === 2 ? 'homologacao' : 'producao');

  const httpsAgent = montarHttpsAgentComPem({
    caminhoCertificado,
    senhaCertificado,
    caminhoCa
  });

  const xmlNFe = extrairInnerNFeDoLote(xmlEnviNFe);
  const soap = montarSoapAutorizacao({ cUF, dadosXmlNFe: xmlNFe });

  if (pastaDebug) {
    fs.mkdirSync(pastaDebug, { recursive: true });
    fs.writeFileSync(
      path.join(pastaDebug, `soap-autorizacao-${Date.now()}.xml`),
      soap,
      'utf8'
    );
  }

  let response;

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      response = await axios.post(endpoints.autorizacao, soap, {
        httpsAgent,
        timeout: 60000,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Accept': 'application/soap+xml, text/xml, */*',
          'Connection': 'close',
          'User-Agent': 'Mercadao-NFCe/1.0'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: status => status >= 200 && status < 500
      });
      break;
    } catch (error) {
      const ehErroRede =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'EPIPE';

      if (!ehErroRede || tentativa === 2) {
        throw error;
      }

      await delay(1500);
    }
  }

  const retornoAut = await parseSoapRetorno(response.data);

  if (pastaDebug) {
    fs.writeFileSync(
      path.join(pastaDebug, `soap-retorno-autorizacao-${Date.now()}.xml`),
      retornoAut.bruto,
      'utf8'
    );
  }

  const dadosAut = extrairDadosRetorno(retornoAut);

  if (dadosAut.cStat === '100' || dadosAut.cStat === '150') {
    return {
      sucesso: true,
      codigo: dadosAut.cStat,
      mensagem: dadosAut.xMotivo,
      protocolo: dadosAut.protocolo || null,
      recibo: dadosAut.recibo || null,
      dataAutorizacao: dadosAut.dataAutorizacao || null,
      xmlRetorno: retornoAut.bruto
    };
  }

  if (dadosAut.cStat === '104') {
    return {
      sucesso: ['100', '150'].includes(dadosAut.cStat),
      codigo: dadosAut.cStat,
      mensagem: dadosAut.xMotivo,
      protocolo: dadosAut.protocolo || null,
      recibo: dadosAut.recibo || null,
      dataAutorizacao: dadosAut.dataAutorizacao || null,
      xmlRetorno: retornoAut.bruto
    };
  }

  if (dadosAut.cStat === '103' && dadosAut.recibo) {
    await delay(2500);

    const retornoRecibo = await consultarRecibo({
      cUF,
      tpAmb,
      nRec: dadosAut.recibo,
      httpsAgent
    });

    if (pastaDebug) {
      fs.writeFileSync(
        path.join(pastaDebug, `soap-retorno-recibo-${Date.now()}.xml`),
        retornoRecibo.bruto,
        'utf8'
      );
    }

    const dadosRec = extrairDadosRetorno(retornoRecibo);

    return {
      sucesso: ['100', '150'].includes(dadosRec.cStat),
      codigo: dadosRec.cStat,
      mensagem: dadosRec.xMotivo,
      protocolo: dadosRec.protocolo || null,
      recibo: dadosAut.recibo || null,
      dataAutorizacao: dadosRec.dataAutorizacao || null,
      xmlRetorno: retornoRecibo.bruto
    };
  }

  return {
    sucesso: false,
    codigo: dadosAut.cStat || '0',
    mensagem: dadosAut.xMotivo || 'Retorno desconhecido da SEFAZ',
    protocolo: dadosAut.protocolo || null,
    recibo: dadosAut.recibo || null,
    dataAutorizacao: dadosAut.dataAutorizacao || null,
    xmlRetorno: retornoAut.bruto
  };
}

module.exports = {
  transmitirNfce
};
