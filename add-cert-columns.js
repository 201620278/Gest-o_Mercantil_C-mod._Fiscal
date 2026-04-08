const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'banco', 'mercadao.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco');
});

const columns = [
  'certificado_path',
  'certificado_senha',
  'certificado_validade_inicio',
  'certificado_validade_fim',
  'certificado_serial'
];

let completed = 0;

columns.forEach(col => {
  db.run(`ALTER TABLE configuracao_fiscal ADD COLUMN ${col} TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log(`Coluna ${col} já existe`);
    } else if (err) {
      console.error(`Erro ao adicionar ${col}:`, err.message);
    } else {
      console.log(`Coluna ${col} adicionada`);
    }

    completed++;
    if (completed === columns.length) {
      db.close();
      console.log('Setup concluído');
    }
  });
});