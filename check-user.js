const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'backend', 'banco', 'mercadao.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco');
});

db.get("SELECT * FROM usuarios WHERE username = 'Diego'", [], (err, row) => {
  if (err) {
    console.error('Erro na query:', err);
  } else if (row) {
    console.log('Usuário encontrado:', row);
    const hashCorreto = bcrypt.hashSync('pdb100623', 10);
    console.log('Hash esperado:', hashCorreto);
    console.log('Hash no banco:', row.password_hash);
    console.log('Senha correta?', bcrypt.compareSync('pdb100623', row.password_hash));
  } else {
    console.log('Usuário não encontrado');
  }
  db.close();
});