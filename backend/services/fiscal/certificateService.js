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

function bytesToHexSafe(value) {
  try {
    return value ? forge.util.bytesToHex(value) : null;
  } catch {
    return null;
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

  if (!keyBags.length || !keyBags[0]?.key) {
    throw new Error('Chave privada não encontrada no PFX.');
  }

  const keyBag = keyBags[0];
  privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

  const keyLocalKeyId =
    keyBag.attributes &&
    keyBag.attributes.localKeyId &&
    keyBag.attributes.localKeyId[0]
      ? bytesToHexSafe(keyBag.attributes.localKeyId[0])
      : null;

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];

  if (!certBags.length) {
    throw new Error('Nenhum certificado encontrado dentro do PFX.');
  }

  const certs = certBags.filter((bag) => bag?.cert);

  let certBagFolha = null;

  if (keyLocalKeyId) {
    certBagFolha = certs.find((bag) => {
      const certLocalKeyId =
        bag.attributes &&
        bag.attributes.localKeyId &&
        bag.attributes.localKeyId[0]
          ? bytesToHexSafe(bag.attributes.localKeyId[0])
          : null;

      return certLocalKeyId && certLocalKeyId === keyLocalKeyId;
    });
  }

  if (!certBagFolha) {
    certBagFolha = certs.find((bag) => {
      const cert = bag.cert;
      if (!cert) return false;
      return !isCaCertificate(cert);
    }) || certs[0];
  }

  if (!certBagFolha || !certBagFolha.cert) {
    throw new Error('Certificado folha não encontrado no PFX.');
  }

  certPem = forge.pki.certificateToPem(certBagFolha.cert);
  certBase64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(certBagFolha.cert)).getBytes()
  );

  const intermediarios = certs
    .filter((bag) => bag.cert && bag.cert !== certBagFolha.cert)
    .map((bag) => bag.cert)
    .filter((cert) => isCaCertificate(cert) && !isSelfSigned(cert));

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
