const fs = require('fs');
const forge = require('node-forge');

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
  let certChainPem = '';

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

  const certificadosPem = certBags
    .filter((bag) => bag?.cert)
    .map((bag) => forge.pki.certificateToPem(bag.cert));

  certChainPem = certificadosPem.join('\n');

  const certPrincipalBag =
    certBags.find((bag) => {
      const cert = bag.cert;
      if (!cert) return false;

      const bc = cert.getExtension('basicConstraints');
      return !(bc && bc.cA === true);
    }) || certBags[0];

  if (certPrincipalBag?.cert) {
    certPem = forge.pki.certificateToPem(certPrincipalBag.cert);
    certBase64 = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(certPrincipalBag.cert)).getBytes()
    );
  }

  if (!privateKeyPem || !certPem || !certBase64) {
    throw new Error('Não foi possível extrair chave privada e certificado do PFX.');
  }

  return {
    privateKeyPem,
    certPem,
    certBase64,
    certChainPem
  };
}

module.exports = { carregarCertificadoPfx };
