const https = require('https');
const path = require('path');
const fs = require('fs');
const certificadoService = require('./backend/services/certificadoService');

const urls = [
  'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl',
  'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4',
  'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4?wsdl',
  'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4',
  'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4/NFeAutorizacao4?wsdl',
  'https://nfeh.sefaz.ce.gov.br/nfe/services',
  'https://nfeh.sefaz.ce.gov.br/nfe/'
];

function findCertificate() {
  const explicitPath = process.argv[2];
  const senha = process.argv[3] || '1234';

  if (explicitPath && fs.existsSync(explicitPath)) {
    return { path: explicitPath, senha };
  }

  const certDir = path.join(__dirname, 'backend', 'storage', 'certificados');
  if (!fs.existsSync(certDir)) {
    throw new Error(`Diretório de certificados não encontrado: ${certDir}`);
  }

  const files = fs.readdirSync(certDir).filter((file) => file.toLowerCase().endsWith('.pfx') || file.toLowerCase().endsWith('.p12'));
  if (!files.length) {
    throw new Error(`Nenhum .pfx ou .p12 encontrado em ${certDir}. Passe o caminho como argumento.`);
  }

  return { path: path.join(certDir, files[0]), senha };
}

(async () => {
  try {
    const { path: certPath, senha } = findCertificate();
    console.log('Usando certificado:', certPath);
    const validacao = certificadoService.validarCertificadoPfx(certPath, senha);
    if (!validacao.ok) {
      throw new Error(`Certificado inválido: ${validacao.error} ${validacao.detalhes || ''}`);
    }

    const key = validacao.pemKey;
    const cert = validacao.pemCert;

    for (const url of urls) {
      try {
        const res = await new Promise((resolve, reject) => {
          const req = https.get(url, { key, cert, rejectUnauthorized: false }, (res) => {
            resolve({ status: res.statusCode, headers: res.headers });
          });
          req.on('error', (err) => reject(err));
        });
        console.log(url, res.status, res.headers['content-type']);
      } catch (err) {
        console.log(url, 'ERROR', err.message);
      }
    }
  } catch (err) {
    console.error('Erro no script:', err.message);
    process.exit(1);
  }
})();
