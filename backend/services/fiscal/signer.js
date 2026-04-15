const { SignedXml } = require('xml-crypto');

function assinarXmlNfe(xml, certificado) {
  const sig = new SignedXml();

  sig.privateKey = certificado.privateKeyPem;
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

  sig.getKeyInfoContent = () =>
    `<X509Data><X509Certificate>${certificado.certBase64}</X509Certificate></X509Data>`;

  sig.getCertFromKeyInfo = () => null;

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  });

  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='infNFe']", action: 'after' }
  });

  return sig.getSignedXml();
}

module.exports = { assinarXmlNfe };