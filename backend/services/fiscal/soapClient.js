const axios = require('axios');
const https = require('https');
const { carregarCertificadoPfx } = require('./certificateService');

function montarLote(xmlAssinado, idLote = '1') {
  return `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${xmlAssinado.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}
</enviNFe>`;
}

function montarSoapEnvelop(loteXml, cUF = '23', versaoDados = '4.00') {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>${cUF}</cUF>
      <versaoDados>${versaoDados}</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeAutorizacaoLote xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <nfeDadosMsg>
        ${loteXml}
      </nfeDadosMsg>
    </nfeAutorizacaoLote>
  </soap12:Body>
</soap12:Envelope>`;
}

function criarHttpsAgentSefaz({ certificadoPath, certificadoSenha, url }) {
  if (!certificadoPath) {
    throw new Error('Certificado não configurado.');
  }

  const certificado = carregarCertificadoPfx(certificadoPath, certificadoSenha);
  const host = new URL(url).hostname;

  console.log('USANDO CERTIFICADO:', certificadoPath);
  console.log('HOST SEFAZ:', host);

  return new https.Agent({
    key: certificado.privateKeyPem,
    cert: certificado.certBundlePem,
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    keepAlive: false,
    servername: host
  });
}

async function enviarLote({
  url,
  loteXml,
  certificadoPath,
  certificadoSenha,
  cUF = '23',
  versaoDados = '4.00'
}) {
  if (!url) {
    return {
      success: false,
      status: 'configuracao_pendente',
      message: 'URL de autorização não configurada.'
    };
  }

  const envelope = montarSoapEnvelop(loteXml, cUF, versaoDados);

  try {
    const httpsAgent = criarHttpsAgentSefaz({
      certificadoPath,
      certificadoSenha,
      url
    });

    console.log('Enviando para SEFAZ URL:', url);
    console.log('SOAP 1.2 com wrapper nfeAutorizacaoLote habilitado');

    const response = await axios.post(url, envelope, {
      httpsAgent,
      proxy: false,
      timeout: 30000,
      responseType: 'text',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transitional: {
        forcedJSONParsing: false
      },
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        'Accept': 'application/soap+xml, text/xml, */*',
        'User-Agent': 'CDGESTAO-NFCE/1.0'
      }
    });

    return {
      success: true,
      status: 'soap_enviado',
      raw: response.data
    };
  } catch (error) {
    console.error('ERRO REAL SEFAZ:', error.message);
    console.error('ERRO CODE:', error.code || null);
    console.error('ERRO STATUS HTTP:', error.response?.status || null);
    console.error('ERRO HEADERS:', error.response?.headers || null);
    console.error('ERRO RESPONSE:', error.response?.data || null);

    return {
      success: false,
      status: 'erro_transmissao',
      message: error.response?.data || error.message || String(error),
      code: error.code || null
    };
  }
}

module.exports = {
  montarLote,
  montarSoapEnvelop,
  enviarLote
};