const https = require('https');
const fs = require('fs');
const QRCode = require('qrcode');
const certificadoService = require('./certificadoService');

const endpoints = {
  homologacao: [
    process.env.SEFAZ_NFCE_AUTORIZACAO_HOMOLOGACAO_URL || 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl',
    'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4',
    'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4?wsdl',
    'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4',
    'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4?wsdl'
  ],
  producao: [
    process.env.SEFAZ_NFCE_AUTORIZACAO_PRODUCAO_URL || 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl',
    'https://nfe.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4',
    'https://nfe.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4?wsdl',
    'https://nfe.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4',
    'https://nfe.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4?wsdl'
  ]
};

function getEndpointCandidates(ambiente) {
  return endpoints[ambiente === 'producao' ? 'producao' : 'homologacao'];
}

function parseTag(xml, tag) {
  const regex = new RegExp(`<(?:[\w-]+:)?${tag}(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function buildSoapEnvelope(xmlAssinado) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">\n` +
    `  <soap12:Header>\n` +
    `    <nfe:nfeCabecMsg xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">\n` +
    `      <cUF>23</cUF>\n` +
    `      <versaoDados>4.00</versaoDados>\n` +
    `    </nfe:nfeCabecMsg>\n` +
    `  </soap12:Header>\n` +
    `  <soap12:Body>\n` +
    `    <nfe:nfeAutorizacaoLote>\n` +
    `      <nfe:nfeDadosMsg><![CDATA[${xmlAssinado}]]></nfe:nfeDadosMsg>\n` +
    `    </nfe:nfeAutorizacaoLote>\n` +
    `  </soap12:Body>\n` +
    `</soap12:Envelope>`;
}

function extractChaveAcesso(xmlAssinado) {
  const match = xmlAssinado.match(/<infNFe[^>]*Id="NFe([^\"]+)"/);
  return match ? match[1] : null;
}

function gerarQrCodeUrl(chaveAcesso) {
  return `https://www.sefaz.ce.gov.br/nfce/consulta?qrcode=${chaveAcesso}`;
}

function parseSefazResponse(xml) {
  const codigo = parseTag(xml, 'cStat') || '0';
  const mensagem = parseTag(xml, 'xMotivo') || parseTag(xml, 'xMensagem') || parseTag(xml, 'xText') || parseTag(xml, 'Text') || parseTag(xml, 'faultstring') || 'Retorno desconhecido';
  const protocolo = parseTag(xml, 'nProt') || null;
  const recibo = parseTag(xml, 'nRec') || null;
  const dataAutorizacao = parseTag(xml, 'dhRecbto') || null;
  return {
    codigo,
    mensagem,
    protocolo,
    recibo,
    dataAutorizacao,
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

function transmitirNfce(xmlAssinado, ambiente, certificadoPath, certificadoSenha) {
  return new Promise(async (resolve, reject) => {
    if (!certificadoPath || !certificadoSenha) {
      return reject(new Error('Certificado e senha devem ser fornecidos para transmissão SEFAZ.'));
    }

    if (!fs.existsSync(certificadoPath)) {
      return reject(new Error('Arquivo de certificado não encontrado: ' + certificadoPath));
    }

    const endpointCandidates = getEndpointCandidates(ambiente);
    const envelope = buildSoapEnvelope(xmlAssinado);
    const chaveAcesso = extractChaveAcesso(xmlAssinado);
    const qrCodeUrl = chaveAcesso ? gerarQrCodeUrl(chaveAcesso) : null;

    let qrCodeBase64 = null;
    if (qrCodeUrl) {
      try {
        qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
          width: 250,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
      }
    }

    const validacaoCert = certificadoService.validarCertificadoPfx(certificadoPath, certificadoSenha);
    if (!validacaoCert.ok) {
      return reject(new Error(`Erro ao carregar certificado: ${validacaoCert.error} ${validacaoCert.detalhes || ''}`.trim()));
    }

    const sendRequest = (endpointUrl) => {
      return new Promise((resolveSend, rejectSend) => {
        const url = new URL(endpointUrl);
        const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';
        const requestOptions = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
            'SOAPAction': soapAction,
            'Content-Length': Buffer.byteLength(envelope),
            'Cache-Control': 'no-cache'
          },
          key: validacaoCert.pemKey,
          cert: validacaoCert.pemCert,
          rejectUnauthorized: ambiente === 'producao'
        };

        const req = https.request(requestOptions, (res) => {
          let body = '';
          res.setEncoding('utf8');

          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return rejectSend(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${body}`));
            }

            const soapFault = parseSoapFault(body);
            if (soapFault) {
              return rejectSend(new Error(`SEFAZ SOAP Fault: ${soapFault}`));
            }

            resolveSend({ body, endpointUrl });
          });
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
        return resolve(retorno);
      } catch (error) {
        lastError = error;
        if (!/HTTP 404/.test(error.message) && !/404/.test(error.message)) {
          return reject(error);
        }
        console.warn(`[SEFAZ] endpoint ${candidate} falhou com 404, tentando próximo candidato.`);
      }
    }

    reject(lastError || new Error('Não foi possível transmitir para nenhum endpoint SEFAZ.'));
  });
}

module.exports = { transmitirNfce };

