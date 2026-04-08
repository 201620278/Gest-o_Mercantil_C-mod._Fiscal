const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const certificadosDir = path.join(__dirname, '..', 'storage', 'certificados');

function garantirPastaCertificados() {
  if (!fs.existsSync(certificadosDir)) {
    fs.mkdirSync(certificadosDir, { recursive: true });
  }
}

function somenteNomeSeguro(nome) {
  return String(nome || 'certificado.pfx')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_');
}

function formatarData(data) {
  if (!data) return null;
  return new Date(data).toISOString();
}

function carregarPfx(filePath, senha) {
  const buffer = fs.readFileSync(filePath);
  const binary = buffer.toString('binary');
  const asn1 = forge.asn1.fromDer(binary);
  return forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
}

function obterChaveECertificado(p12) {
  let privateKey = null;
  let certificate = null;

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];

  if (keyBags.length > 0) {
    privateKey = keyBags[0].key || null;
  }

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];

  if (certBags.length > 0) {
    certificate = certBags[0].cert || null;
  }

  return { privateKey, certificate };
}

function extrairInfosDoCertificado(certificate) {
  const subject = {};
  const issuer = {};

  (certificate.subject.attributes || []).forEach(attr => {
    subject[attr.shortName || attr.name] = attr.value;
  });

  (certificate.issuer.attributes || []).forEach(attr => {
    issuer[attr.shortName || attr.name] = attr.value;
  });

  return {
    serialNumber: certificate.serialNumber || null,
    validFrom: formatarData(certificate.validity?.notBefore),
    validTo: formatarData(certificate.validity?.notAfter),
    subject,
    issuer
  };
}

function validarCertificadoPfx(filePath, senha) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        error: 'Arquivo do certificado não encontrado.'
      };
    }

    if (!senha || String(senha).trim() === '') {
      return {
        ok: false,
        error: 'Senha do certificado não informada.'
      };
    }

    const p12 = carregarPfx(filePath, senha);
    const { privateKey, certificate } = obterChaveECertificado(p12);

    if (!privateKey) {
      return {
        ok: false,
        error: 'Chave privada não encontrada no certificado.'
      };
    }

    if (!certificate) {
      return {
        ok: false,
        error: 'Certificado público não encontrado no PFX.'
      };
    }

    return {
      ok: true,
      info: extrairInfosDoCertificado(certificate),
      pemKey: forge.pki.privateKeyToPem(privateKey),
      pemCert: forge.pki.certificateToPem(certificate)
    };
  } catch (error) {
    return {
      ok: false,
      error: 'Não foi possível validar o certificado.',
      detalhes: error.message
    };
  }
}

function salvarArquivoCertificado(file) {
  garantirPastaCertificados();

  const fileName = `${Date.now()}_${somenteNomeSeguro(file.originalname)}`;
  const filePath = path.join(certificadosDir, fileName);

  fs.renameSync(file.path, filePath);

  return {
    fileName,
    filePath
  };
}

function carregarCertificadoSalvo(caminhoCertificado, senha) {
  const resultado = validarCertificadoPfx(caminhoCertificado, senha);

  if (!resultado.ok) {
    const erro = new Error(resultado.error || 'Erro ao carregar certificado.');
    erro.detalhes = resultado.detalhes;
    throw erro;
  }

  return resultado;
}

module.exports = {
  garantirPastaCertificados: garantirPastaCertificados,
  salvarArquivoCertificado: salvarArquivoCertificado,
  validarCertificadoPfx: validarCertificadoPfx,
  carregarCertificadoSalvo: carregarCertificadoSalvo
};