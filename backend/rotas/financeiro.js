
const express = require('express');
const router = express.Router();
const db = require('../database');
const moment = require('moment');

// Listar movimentações
router.get('/', (req, res) => {
  const { data_inicio, data_fim, tipo, categoria } = req.query;
  
  let sql = 'SELECT * FROM financeiro WHERE 1=1';
  const params = [];
  
  if (data_inicio && data_fim) {
    sql += ' AND data_movimento BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  
  if (tipo) {
    sql += ' AND tipo = ?';
    params.push(tipo);
  }
  
  if (categoria) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }
  
  sql += ' ORDER BY data_movimento DESC, created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Criar movimentação
router.post('/', (req, res) => {
  const { tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id, referencia_tipo } = req.body;
  
  db.run(`
    INSERT INTO financeiro (tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id, referencia_tipo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id || null, referencia_tipo || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Movimentação registrada com sucesso' });
    });
});

// Atualizar movimentação
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { descricao, valor, data_movimento, categoria, forma_pagamento } = req.body;
  
  db.run(`
    UPDATE financeiro 
    SET descricao = ?, valor = ?, data_movimento = ?, categoria = ?, forma_pagamento = ?
    WHERE id = ?
  `, [descricao, valor, data_movimento, categoria, forma_pagamento, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Movimentação atualizada com sucesso' });
    });
});

// Deletar movimentação
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM financeiro WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Movimentação deletada com sucesso' });
  });
});

// Resumo financeiro
router.get('/resumo', (req, res) => {
  const { data_inicio, data_fim } = req.query;
  
  db.all(`
    SELECT 
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as total_receitas,
      SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as total_despesas,
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) as saldo
    FROM financeiro
    WHERE data_movimento BETWEEN ? AND ?
  `, [data_inicio, data_fim], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows[0]);
  });
});

// Saldo atual
router.get('/saldo', (req, res) => {
  db.get(`
    SELECT 
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as total_receitas,
      SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as total_despesas,
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) as saldo
    FROM financeiro
  `, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

module.exports = router;