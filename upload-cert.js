const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function uploadCertificado() {
  const token = process.argv[2];
  const pfxPath = process.argv[3];
  const senha = process.argv[4];

  if (!token || !pfxPath || !senha) {
    console.error('Uso: node upload-cert.js <token> <caminho_pfx> <senha>');
    process.exit(1);
  }

  if (!fs.existsSync(pfxPath)) {
    console.error(`Arquivo não encontrado: ${pfxPath}`);
    process.exit(1);
  }

  try {
    const form = new FormData();
    form.append('certificado', fs.createReadStream(pfxPath));
    form.append('senha', senha);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/fiscal/config/certificado',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('Resposta:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Resposta:', data);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Erro:', e.message);
      process.exit(1);
    });

    form.pipe(req);
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

uploadCertificado();