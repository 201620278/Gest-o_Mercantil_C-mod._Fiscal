const express = require('express');
const router = express.Router();
const db = require('../database');
const backup = require('../backup');

// Listar todas as configurações
router.get('/', (req, res) => {
  db.all('SELECT * FROM configuracoes ORDER BY chave', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Buscar configuração por chave
router.get('/:chave', (req, res) => {
  const { chave } = req.params;
  db.get('SELECT * FROM configuracoes WHERE chave = ?', [chave], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

// Atualizar configuração
router.put('/:chave', (req, res) => {
  const { chave } = req.params;
  const { valor } = req.body;
  
  db.run(`
    UPDATE configuracoes 
    SET valor = ?, updated_at = CURRENT_TIMESTAMP
    WHERE chave = ?
  `, [valor, chave],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Configuração atualizada com sucesso' });
    });
});

// Criar nova configuração
router.post('/', (req, res) => {
  const { chave, valor, tipo, descricao } = req.body;
  
  db.run(`
    INSERT INTO configuracoes (chave, valor, tipo, descricao)
    VALUES (?, ?, ?, ?)
  `, [chave, valor, tipo, descricao],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Configuração criada com sucesso' });
    });
});

// Backup: obter configurações
router.get('/backup', (req, res) => {
  const config = backup.loadConfig();
  res.json(config);
});

// Backup: salvar configurações
router.post('/backup', (req, res) => {
  const config = req.body;
  backup.saveConfig(config);
  backup.scheduleBackup(config);
  res.json({ success: true });
});

// Backup manual
router.post('/backup/manual', async (req, res) => {
  const config = backup.loadConfig();
  if (!config.enabled) return res.status(400).json({ error: 'Backup não está habilitado.' });
  const result = await backup.uploadBackupToDrive(config.google);
  if (result.success) {
    res.json({ success: true, file: result.file });
  } else {
    res.status(500).json({ error: result.error });
  }
});

module.exports = router;
module.exports = router;