const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const tls = require('tls');
const { parseStringPromise } = require('xml2js');
const certificadoService = require('../certificadoService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizarXml(xml = '') {
  return String(xml)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function extrairEnviNFe(xmlEnviNFe) {
  const xml = normalizarXml(xmlEnviNFe);

  const match = xml.match(/<enviNFe\b[\s\S]*<\/enviNFe>/i);
  if (!match) {
    throw new Error('Não foi possível localizar o bloco <enviNFe>...</enviNFe> no XML.');
  }

  return match[0];
}

function montarSoapAutorizacao({ cUF, xmlEnviNFe }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>${cUF}</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${xmlEnviNFe}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function montarSoapRetAutorizacao({ cUF, xmlConsReciNFe }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <cUF>${cUF}</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      ${xmlConsReciNFe}
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

function montarHttpsAgent({ caminhoCertificado, senhaCertificado }) {
  if (!caminhoCertificado) {
    throw new Error('Caminho do certificado não informado.');
  }

  const caminhoResolvido = path.resolve(caminhoCertificado);

  if (!fs.existsSync(caminhoResolvido)) {
    throw new Error(`Certificado não encontrado: ${caminhoResolvido}`);
  }

  const certInfo = certificadoService.carregarCertificadoSalvo(
    caminhoResolvido,
    senhaCertificado
  );

  if (!certInfo.pemKey || !certInfo.pemCert) {
    throw new Error('Não foi possível extrair PEM key/cert do certificado A1.');
  }

  return new https.Agent({
    key: certInfo.pemKey,
    cert: certInfo.pemCert,

    // MUITO IMPORTANTE:
    // não sobrescrever "ca" manualmente aqui.
    // isso evita voltar o erro "unable to get local issuer certificate".

    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.2',
    keepAlive: false,
    rejectUnauthorized: true,
    honorCipherOrder: true,
    servername: 'nfce-homologacao.svrs.rs.gov.br',
    secureOptions: tls.constants?.SSL_OP_LEGACY_SERVER_CONNECT || 0
  });
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
    body.nfeRetAutorizacaoResult ||
    body.retEnviNFe ||
    body.retConsReciNFe ||
    body;

  return { bruto: xml, obj, ret };
}

function localizarRetorno(ret) {
  if (!ret) return null;
  if (ret.retEnviNFe) return ret.retEnviNFe;
  if (ret.retConsReciNFe) return ret.retConsReciNFe;
  return ret;
}

function extrairDadosRetorno(retornoParseado) {
  const raiz = localizarRetorno(retornoParseado?.ret) || {};
  const prot = raiz.protNFe?.infProt || {};
  const infRec = raiz.infRec || {};

  return {
    codigo: String(prot.cStat || raiz.cStat || ''),
    mensagem: String(prot.xMotivo || raiz.xMotivo || ''),
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

  const soap = montarSoapRetAutorizacao({ cUF, xmlConsReciNFe });

  const response = await axios.post(endpoints.retAutorizacao, soap, {
    httpsAgent,
    timeout,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      Accept: 'application/soap+xml, text/xml, */*',
      Connection: 'close',
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
  const caminhoCertificado =
    certificado?.caminhoCertificado ||
    certificado?.caminho_pfx ||
    certificado?.caminho_p12;

  const senhaCertificado =
    certificado?.senhaCertificado ||
    certificado?.senha;

  if (!caminhoCertificado) {
    throw new Error('Certificado não configurado para transmissão.');
  }

  if (!senhaCertificado) {
    throw new Error('Senha do certificado não informada.');
  }

  const tpAmb = Number(configuracaoFiscal?.ambiente || 2);
  const cUF = String(configuracaoFiscal?.uf_codigo || '23');
  const endpoints = obterEndpointsNfce(tpAmb === 2 ? 'homologacao' : 'producao');

  const httpsAgent = montarHttpsAgent({
    caminhoCertificado,
    senhaCertificado
  });

  const xmlLote = extrairEnviNFe(xmlEnviNFe);
  const soap = montarSoapAutorizacao({
    cUF,
    xmlEnviNFe: xmlLote
  });

  if (pastaDebug) {
    fs.mkdirSync(pastaDebug, { recursive: true });
    fs.writeFileSync(
      path.join(pastaDebug, `soap-autorizacao-${Date.now()}.xml`),
      soap,
      'utf8'
    );
  }

  let response;
  let ultimoErro;

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      response = await axios.post(endpoints.autorizacao, soap, {
        httpsAgent,
        timeout: 60000,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          Accept: 'application/soap+xml, text/xml, */*',
          Connection: 'close',
          'User-Agent': 'Mercadao-NFCe/1.0'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: status => status >= 200 && status < 500
      });

      break;
    } catch (error) {
      ultimoErro = error;

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

  if (!response) {
    throw ultimoErro || new Error('Falha ao obter resposta da SEFAZ.');
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

  if (['100', '150'].includes(dadosAut.codigo)) {
    return {
      sucesso: true,
      codigo: dadosAut.codigo,
      mensagem: dadosAut.mensagem,
      protocolo: dadosAut.protocolo || null,
      recibo: dadosAut.recibo || null,
      dataAutorizacao: dadosAut.dataAutorizacao || null,
      xmlRetorno: retornoAut.bruto
    };
  }

  if (dadosAut.codigo === '103' && dadosAut.recibo) {
    await delay(2500);

    const retornoRec = await consultarRecibo({
      cUF,
      tpAmb,
      nRec: dadosAut.recibo,
      httpsAgent
    });

    if (pastaDebug) {
      fs.writeFileSync(
        path.join(pastaDebug, `soap-retorno-recibo-${Date.now()}.xml`),
        retornoRec.bruto,
        'utf8'
      );
    }

    const dadosRec = extrairDadosRetorno(retornoRec);

    return {
      sucesso: ['100', '150'].includes(dadosRec.codigo),
      codigo: dadosRec.codigo,
      mensagem: dadosRec.mensagem,
      protocolo: dadosRec.protocolo || null,
      recibo: dadosAut.recibo || null,
      dataAutorizacao: dadosRec.dataAutorizacao || null,
      xmlRetorno: retornoRec.bruto
    };
  }

  return {
    sucesso: false,
    codigo: dadosAut.codigo || '0',
    mensagem: dadosAut.mensagem || 'Retorno desconhecido da SEFAZ',
    protocolo: dadosAut.protocolo || null,
    recibo: dadosAut.recibo || null,
    dataAutorizacao: dadosAut.dataAutorizacao || null,
    xmlRetorno: retornoAut.bruto
  };
}

module.exports = {
  transmitirNfce
};
