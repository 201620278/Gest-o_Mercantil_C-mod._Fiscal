const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

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

function montarHttpsAgentSeguro({
  caminhoCertificado,
  senhaCertificado,
  caminhoCa
}) {
  if (!caminhoCertificado) {
    throw new Error('Certificado não informado.');
  }

  const caminhoResolvido = path.resolve(caminhoCertificado);

  if (!fs.existsSync(caminhoResolvido)) {
    throw new Error(`Arquivo do certificado não encontrado: ${caminhoResolvido}`);
  }

  const ext = path.extname(caminhoResolvido).toLowerCase();
  const bufferCert = fs.readFileSync(caminhoResolvido);

  const agentOptions = {
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

  if (ext === '.pfx' || ext === '.p12') {
    agentOptions.pfx = bufferCert;
    agentOptions.passphrase = senhaCertificado || '';

    try {
      return new https.Agent(agentOptions);
    } catch (error) {
      if (
        String(error.message || '').includes('Unsupported PKCS12 PFX data') ||
        error.code === 'ERR_CRYPTO_UNSUPPORTED_OPERATION'
      ) {
        throw new Error(
          'O arquivo informado como certificado PFX/P12 é inválido, está corrompido, está com senha errada ou não é realmente um PFX/P12. Verifique se o sistema está apontando para o certificado A1 da empresa (.pfx ou .p12), e não para um arquivo .pem.'
        );
      }
      throw error;
    }
  }

  if (ext === '.pem' || ext === '.crt' || ext === '.cer') {
    throw new Error(
      `Arquivo inválido para certificado do cliente: ${path.basename(caminhoResolvido)}. ` +
      `Esse arquivo é ${ext} e não pode ser usado no campo PFX. ` +
      `No campo do certificado da empresa use o arquivo A1 .pfx ou .p12. ` +
      `O arquivo .pem deve ficar apenas no campo CA/cadeia, se necessário.`
    );
  }

  throw new Error(
    `Formato de certificado não suportado: ${ext}. Use um certificado A1 .pfx ou .p12.`
  );
}

function validarCertificadoAntesDeTransmitir(configFiscal) {
  const caminhoCert = path.resolve(configFiscal.certificado_caminho || '');
  const ext = path.extname(caminhoCert).toLowerCase();

  if (!configFiscal.certificado_caminho) {
    throw new Error('Nenhum certificado foi configurado.');
  }

  if (!fs.existsSync(caminhoCert)) {
    throw new Error(`Certificado não encontrado no caminho: ${caminhoCert}`);
  }

  if (ext !== '.pfx' && ext !== '.p12') {
    throw new Error(
      `Certificado inválido: ${path.basename(caminhoCert)}. ` +
      `Para emissão NFC-e com certificado A1, informe um arquivo .pfx ou .p12.`
    );
  }

  return caminhoCert;
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
    return { bruto: xml, obj };
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

function extrairRecibo(retornoParseado) {
  const ret = retornoParseado?.ret;

  if (!ret) return null;

  if (ret.retEnviNFe?.infRec?.nRec) return ret.retEnviNFe.infRec.nRec;
  if (ret.infRec?.nRec) return ret.infRec.nRec;
  if (ret.nRec) return ret.nRec;

  return null;
}

function extrairCStat(retornoParseado) {
  const ret = retornoParseado?.ret;

  if (!ret) return null;

  if (ret.retEnviNFe?.cStat) return ret.retEnviNFe.cStat;
  if (ret.retConsReciNFe?.cStat) return ret.retConsReciNFe.cStat;
  if (ret.protNFe?.infProt?.cStat) return ret.protNFe.infProt.cStat;
  if (ret.cStat) return ret.cStat;

  return null;
}

function extrairXMotivo(retornoParseado) {
  const ret = retornoParseado?.ret;

  if (!ret) return null;

  if (ret.retEnviNFe?.xMotivo) return ret.retEnviNFe.xMotivo;
  if (ret.retConsReciNFe?.xMotivo) return ret.retConsReciNFe.xMotivo;
  if (ret.protNFe?.infProt?.xMotivo) return ret.protNFe.infProt.xMotivo;
  if (ret.xMotivo) return ret.xMotivo;

  return null;
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

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
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
        ${escaparXmlSoap(xmlConsReciNFe)}
      </nfeDadosMsg>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

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
  validarCertificadoAntesDeTransmitir({
    certificado_caminho: certificado?.caminhoCertificado || certificado?.caminho_pfx || certificado?.caminho_pfx,
    certificado_senha: certificado?.senha || certificado?.senhaCertificado
  });

  const tpAmb = Number(configuracaoFiscal?.ambiente || 2);
  const cUF = String(configuracaoFiscal?.uf_codigo || '23');

  const endpoints = obterEndpointsNfce(tpAmb === 2 ? 'homologacao' : 'producao');

  const httpsAgent = montarHttpsAgentSeguro({
    caminhoCertificado: certificado?.caminhoCertificado || certificado?.caminho_pfx || certificado?.caminho_pfx,
    senhaCertificado: certificado?.senhaCertificado || certificado?.senha,
    caminhoCa: certificado?.caminhoCa || certificado?.caminho_ca || process.env.NODE_EXTRA_CA_CERTS
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
  let ultimoErro;

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

  const retornoAut = await parseSoapRetorno(response.data);

  if (pastaDebug) {
    fs.writeFileSync(
      path.join(pastaDebug, `soap-retorno-autorizacao-${Date.now()}.xml`),
      retornoAut.bruto,
      'utf8'
    );
  }

  const cStat = extrairCStat(retornoAut);
  const xMotivo = extrairXMotivo(retornoAut);
  const nRec = extrairRecibo(retornoAut);

  if (String(cStat) === '104' || String(cStat) === '100' || String(cStat) === '150') {
    return {
      sucesso: true,
      fase: 'autorizado',
      cStat,
      xMotivo,
      retorno: retornoAut
    };
  }

  if (String(cStat) === '103' && nRec) {
    await delay(2500);

    const retornoRecibo = await consultarRecibo({
      cUF,
      tpAmb,
      nRec,
      httpsAgent
    });

    if (pastaDebug) {
      fs.writeFileSync(
        path.join(pastaDebug, `soap-retorno-recibo-${Date.now()}.xml`),
        retornoRecibo.bruto,
        'utf8'
      );
    }

    const cStatRec = extrairCStat(retornoRecibo);
    const xMotivoRec = extrairXMotivo(retornoRecibo);

    return {
      sucesso: ['100', '104', '150'].includes(String(cStatRec)),
      fase: 'recibo',
      recibo: nRec,
      cStat: cStatRec,
      xMotivo: xMotivoRec,
      retorno: retornoRecibo
    };
  }

  return {
    sucesso: false,
    fase: 'autorizacao',
    cStat,
    xMotivo,
    retorno: retornoAut
  };
}

module.exports = {
  transmitirNfce
};
