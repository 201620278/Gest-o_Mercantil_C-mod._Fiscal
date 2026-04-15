const fs = require('fs');
const forge = require('node-forge');

function isCaCertificate(cert) {
  const bc = cert.getExtension('basicConstraints');
  return !!(bc && bc.cA === true);
}

function isSelfSigned(cert) {
  try {
    return cert.issuer.hash === cert.subject.hash;
  } catch {
    return false;
  }
}

function carregarCertificadoPfx(certificadoPath, senha) {
  if (!certificadoPath) {
    throw new Error('Caminho do certificado não configurado.');
  }

  if (!fs.existsSync(certificadoPath)) {
    throw new Error(`Certificado não encontrado em: ${certificadoPath}`);
  }

  const pfxBuffer = fs.readFileSync(certificadoPath);
  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha || '');

  let privateKeyPem = '';
  let certPem = '';
  let certBase64 = '';
  let certBundlePem = '';

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];

  if (keyBags[0]?.key) {
    privateKeyPem = forge.pki.privateKeyToPem(keyBags[0].key);
  }

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];

  if (!certBags.length) {
    throw new Error('Nenhum certificado encontrado dentro do PFX.');
  }

  const certs = certBags
    .filter((bag) => bag?.cert)
    .map((bag) => bag.cert);

  const certPrincipal =
    certs.find((cert) => !isCaCertificate(cert)) || certs[0];

  const intermediarios = certs.filter((cert) => {
    if (cert === certPrincipal) return false;
    return isCaCertificate(cert) && !isSelfSigned(cert);
  });

  certPem = forge.pki.certificateToPem(certPrincipal);
  certBase64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(certPrincipal)).getBytes()
  );

  certBundlePem = [certPem, ...intermediarios.map((c) => forge.pki.certificateToPem(c))].join('\n');

  if (!privateKeyPem || !certPem || !certBase64) {
    throw new Error('Não foi possível extrair chave privada e certificado do PFX.');
  }

  return {
    privateKeyPem,
    certPem,
    certBase64,
    certBundlePem
  };
}

module.exports = { carregarCertificadoPfx };
