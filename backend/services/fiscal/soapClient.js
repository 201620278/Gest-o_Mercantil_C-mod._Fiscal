const axios = require('axios');

function montarLote(xmlAssinado, idLote = '1') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${xmlAssinado.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}
</enviNFe>`;
}

function montarSoapEnvelop(loteXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${loteXml}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

async function enviarLote({ url, loteXml }) {
  if (!url) {
    return {
      success: false,
      status: 'configuracao_pendente',
      message: 'URL de autorização não configurada.'
    };
  }

  const envelope = montarSoapEnvelop(loteXml);

  try {
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8'
      },
      timeout: 30000
    });

    return {
      success: true,
      status: 'soap_enviado',
      raw: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: 'erro_transmissao',
      message: error.response?.data || error.message
    };
  }
}

module.exports = {
  montarLote,
  enviarLote
};
