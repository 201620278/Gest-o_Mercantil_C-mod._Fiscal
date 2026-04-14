const https = require('https');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const certificadoService = require('./certificadoService');

const endpoints = {
  homologacao: [
    'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
  ],
  producao: [
    'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
  ]
};

function getEndpointCandidates(ambiente) {
  return endpoints[ambiente === 'producao' ? 'producao' : 'homologacao'];
}

function parseTag(xml, tag) {
  const regex = new RegExp(
    `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    'i'
  );
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function buildSoapEnvelope(xmlAssinado) {
  const xmlPayload = String(xmlAssinado || '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s+/, '')
    .replace(/^<\?xml[^>]*\?>\s*/i, '')
    .trim();

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
      ${xmlPayload}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function extractChaveAcesso(xmlAssinado) {
  const match = String(xmlAssinado || '').match(/Id="NFe([^"]+)"/);
  return match ? match[1] : null;
}

function gerarQrCodeUrl(chaveAcesso) {
  return `https://www.sefaz.ce.gov.br/nfce/consulta?qrcode=${chaveAcesso}`;
}

function parseSefazResponse(xml) {
  const protMatch = xml.match(
    /<cStat>(.*?)<\/cStat>[\s\S]*?<xMotivo>(.*?)<\/xMotivo>[\s\S]*?(?:<nProt>(.*?)<\/nProt>)?[\s\S]*?(?:<dhRecbto>(.*?)<\/dhRecbto>)?[\s\S]*?<\/infProt>[\s\S]*?<\/protNFe>/i
  );

  if (protMatch) {
    return {
      codigo: (protMatch[1] || '').trim() || '0',
      mensagem: (protMatch[2] || '').trim() || 'Retorno desconhecido',
      protocolo: protMatch[3] ? protMatch[3].trim() : null,
      recibo: parseTag(xml, 'nRec') || null,
      dataAutorizacao: protMatch[4] ? protMatch[4].trim() : null,
      xmlRetorno: xml
    };
  }

  return {
    codigo: parseTag(xml, 'cStat') || '0',
    mensagem:
      parseTag(xml, 'xMotivo') ||
      parseTag(xml, 'xMensagem') ||
      parseTag(xml, 'xText') ||
      parseTag(xml, 'Text') ||
      parseTag(xml, 'faultstring') ||
      'Retorno desconhecido',
    protocolo: parseTag(xml, 'nProt') || null,
    recibo: parseTag(xml, 'nRec') || null,
    dataAutorizacao: parseTag(xml, 'dhRecbto') || null,
    xmlRetorno: xml
  };
}

function parseSoapFault(xml) {
  const faultString = parseTag(xml, 'faultstring') || parseTag(xml, 'Text');
  const faultCode = parseTag(xml, 'faultcode') || parseTag(xml, 'Code');

  if (faultString || faultCode) {
    return `${faultCode || 'Fault'}: ${faultString || 'Erro SOAP'}`;
  }

  return null;
}

async function transmitirNfce(xmlAssinado, ambiente, certificadoPath, certificadoSenha) {
  if (!certificadoPath || !certificadoSenha) {
    throw new Error('Certificado e senha devem ser fornecidos para transmissão SEFAZ.');
  }

  if (!fs.existsSync(certificadoPath)) {
    throw new Error(`Arquivo de certificado não encontrado: ${certificadoPath}`);
  }

  const endpointCandidates = getEndpointCandidates(ambiente);
  const envelope = buildSoapEnvelope(xmlAssinado);
  const chaveAcesso = extractChaveAcesso(xmlAssinado);
  const qrCodeUrl = chaveAcesso ? gerarQrCodeUrl(chaveAcesso) : null;

  const pastaDebug = path.join(__dirname, '..', 'debug');
  if (!fs.existsSync(pastaDebug)) {
    fs.mkdirSync(pastaDebug, { recursive: true });
  }

  const nomeArquivo = `debug-xml-${Date.now()}.xml`;
  const caminhoArquivo = path.join(pastaDebug, nomeArquivo);
  fs.writeFileSync(caminhoArquivo, xmlAssinado, { encoding: 'utf-8' });
  console.log('XML salvo para debug em:', caminhoArquivo);

  let qrCodeBase64 = null;
  if (qrCodeUrl) {
    try {
      qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, { width: 250, margin: 1 });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  }

  const validacaoCert = certificadoService.validarCertificadoPfx(
    certificadoPath,
    certificadoSenha
  );

  if (!validacaoCert.ok) {
    throw new Error(
      `Erro ao carregar certificado: ${validacaoCert.error} ${validacaoCert.detalhes || ''}`.trim()
    );
  }

  const sendRequest = (endpointUrl) => {
    return new Promise((resolveSend, rejectSend) => {
      const url = new URL(endpointUrl);
      const soapAction =
        'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type':
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
          SOAPAction: soapAction,
          Accept: 'application/soap+xml, text/xml, */*',
          Connection: 'close',
          'Cache-Control': 'no-cache',
          'Content-Length': Buffer.byteLength(envelope, 'utf8')
        },
        key: validacaoCert.pemKey,
        cert: validacaoCert.pemCert,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: url.hostname,
        timeout: 180000
      };

      const req = https.request(requestOptions, (res) => {
        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return rejectSend(
              new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${body}`)
            );
          }

          const soapFault = parseSoapFault(body);
          if (soapFault) {
            return rejectSend(new Error(`SEFAZ SOAP Fault: ${soapFault}`));
          }

          resolveSend({ body, endpointUrl });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Timeout ao aguardar resposta da SEFAZ.'));
      });

      req.on('error', (err) => {
        rejectSend(err);
      });

      req.write(envelope, 'utf8');
      req.end();
    });
  };

  let lastError = null;

  for (const candidate of endpointCandidates) {
    try {
      const { body } = await sendRequest(candidate);
      const retorno = parseSefazResponse(body);
      retorno.qrCodeUrl = qrCodeUrl;
      retorno.qrCodeBase64 = qrCodeBase64;
      return retorno;
    } catch (error) {
      lastError = error;
      console.error('ERRO SEFAZ COMPLETO:', {
        endpoint: candidate,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
    }
  }

  throw (
    lastError ||
    new Error('Não foi possível transmitir para nenhum endpoint SEFAZ.')
  );
}

module.exports = {
  transmitirNfce
};