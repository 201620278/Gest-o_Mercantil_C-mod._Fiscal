const fs = require('fs');
const path = require('path');

console.log('testando require necessários...');

try {
  const forge = require('node-forge');
  console.log('forge carregado OK');
} catch (e) {
  console.error('Erro ao carregar forge:', e.message);
}

const certificadosDir = path.join(__dirname, 'backend', 'storage', 'certificados');

function garantirPastaCertificados() {
  if (!fs.existsSync(certificadosDir)) {
    fs.mkdirSync(certificadosDir, { recursive: true });
  }
}

function salvarArquivoCertificado(file) {
  garantirPastaCertificados();
  const fileName = `${Date.now()}_${file.originalname || 'cert.pfx'}`;
  const filePath = path.join(certificadosDir, fileName);
  fs.renameSync(file.path, filePath);
  return { fileName, filePath };
}

function validarCertificadoPfx(filePath, senha) {
  return { ok: true, info: { validFrom: 'NOW', validTo: 'FUTURE' } };
}

function carregarCertificadoSalvo(caminhoCertificado, senha) {
  return validarCertificadoPfx(caminhoCertificado, senha);
}

module.exports = {
  garantirPastaCertificados,
  salvarArquivoCertificado,
  validarCertificadoPfx,
  carregarCertificadoSalvo
};

console.log('módulo exportado');
