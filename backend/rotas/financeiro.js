const express = require('express');
const router = express.Router();
const db = require('../database');
const moment = require('moment');

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatoStatus(tipo, status) {
  if (status) return status;
  return tipo === 'receita' ? 'recebido' : 'pago';
}

function inserirMovimentacao(data) {
  return new Promise((resolve, reject) => {
    const {
      tipo,
      descricao,
      valor,
      data_movimento,
      categoria,
      forma_pagamento,
      referencia_id,
      referencia_tipo,
      status,
      origem,
      documento,
      vencimento,
      numero_parcela,
      total_parcelas,
      compra_id,
      venda_id,
      pessoa_nome,
      observacao
    } = data;

    db.run(`
      INSERT INTO financeiro (
        tipo, descricao, valor, data_movimento, categoria, forma_pagamento,
        referencia_id, referencia_tipo, status, origem, documento, vencimento,
        numero_parcela, total_parcelas, compra_id, venda_id, pessoa_nome, observacao,
        baixado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tipo,
      descricao,
      valor,
      data_movimento,
      categoria || null,
      forma_pagamento || null,
      referencia_id || null,
      referencia_tipo || null,
      formatoStatus(tipo, status),
      origem || 'manual',
      documento || null,
      vencimento || data_movimento,
      numero_parcela || null,
      total_parcelas || null,
      compra_id || null,
      venda_id || null,
      pessoa_nome || null,
      observacao || null,
      ['pago', 'recebido'].includes(formatoStatus(tipo, status)) ? (data.baixado_em || data_movimento) : null
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

router.get('/', (req, res) => {
  const { data_inicio, data_fim, tipo, categoria, forma_pagamento, status, origem } = req.query;

  let sql = 'SELECT * FROM financeiro WHERE 1=1';
  const params = [];

  if (data_inicio && data_fim) {
    sql += ' AND COALESCE(vencimento, data_movimento) BETWEEN ? AND ?';
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
  if (forma_pagamento) {
    sql += ' AND forma_pagamento = ?';
    params.push(forma_pagamento);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (origem) {
    sql += ' AND origem = ?';
    params.push(origem);
  }

  sql += ' ORDER BY COALESCE(vencimento, data_movimento) DESC, created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const hoje = moment().format('YYYY-MM-DD');
    const normalizado = rows.map(row => ({
      ...row,
      status_exibicao: (row.status === 'pendente' && row.vencimento && row.vencimento < hoje) ? 'vencido' : row.status
    }));
    res.json(normalizado);
  });
});

router.get('/resumo', (req, res) => {
  const { data_inicio, data_fim, tipo, categoria, forma_pagamento, status, origem } = req.query;

  let sql = `
    SELECT 
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS total_receitas,
      SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS total_despesas,
      SUM(CASE WHEN tipo = 'receita' AND status IN ('recebido','pago') THEN valor ELSE 0 END) AS total_recebido,
      SUM(CASE WHEN tipo = 'despesa' AND status IN ('pago','recebido') THEN valor ELSE 0 END) AS total_pago,
      SUM(CASE WHEN tipo = 'receita' AND status = 'pendente' THEN valor ELSE 0 END) AS total_a_receber,
      SUM(CASE WHEN tipo = 'despesa' AND status = 'pendente' THEN valor ELSE 0 END) AS total_a_pagar
    FROM financeiro
    WHERE 1=1
  `;
  const params = [];

  if (data_inicio && data_fim) {
    sql += ' AND COALESCE(vencimento, data_movimento) BETWEEN ? AND ?';
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
  if (forma_pagamento) {
    sql += ' AND forma_pagamento = ?';
    params.push(forma_pagamento);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (origem) {
    sql += ' AND origem = ?';
    params.push(origem);
  }

  db.get(sql, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const resumo = row || {};
    resumo.total_receitas = parseNumber(resumo.total_receitas);
    resumo.total_despesas = parseNumber(resumo.total_despesas);
    resumo.total_recebido = parseNumber(resumo.total_recebido);
    resumo.total_pago = parseNumber(resumo.total_pago);
    resumo.total_a_receber = parseNumber(resumo.total_a_receber);
    resumo.total_a_pagar = parseNumber(resumo.total_a_pagar);
    resumo.saldo = resumo.total_recebido - resumo.total_pago;
    res.json(resumo);
  });
});

router.post('/', (req, res) => {
  const {
    tipo,
    descricao,
    valor,
    data_movimento,
    categoria,
    forma_pagamento,
    documento,
    vencimento,
    observacao,
    compra_id,
    pessoa_nome,
    status
  } = req.body;

  if (!tipo || !descricao || !valor || !data_movimento) {
    res.status(400).json({ error: 'Tipo, descrição, valor e data são obrigatórios.' });
    return;
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    res.status(400).json({ error: 'Tipo de movimentação inválido.' });
    return;
  }

  inserirMovimentacao({
    tipo,
    descricao,
    valor,
    data_movimento,
    categoria,
    forma_pagamento,
    documento,
    vencimento,
    observacao,
    compra_id,
    pessoa_nome,
    origem: 'manual',
    referencia_tipo: 'manual',
    status: status || (tipo === 'despesa' ? 'pendente' : 'recebido')
  }).then((id) => {
    res.json({ id, message: 'Movimentação registrada com sucesso' });
  }).catch((err) => {
    res.status(500).json({ error: err.message });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    descricao,
    valor,
    data_movimento,
    categoria,
    forma_pagamento,
    documento,
    vencimento,
    observacao,
    pessoa_nome,
    status
  } = req.body;

  db.run(`
    UPDATE financeiro
    SET descricao = ?, valor = ?, data_movimento = ?, categoria = ?, forma_pagamento = ?,
        documento = ?, vencimento = ?, observacao = ?, pessoa_nome = ?, status = ?,
        baixado_em = CASE WHEN ? IN ('pago','recebido') THEN COALESCE(baixado_em, DATE('now')) ELSE NULL END
    WHERE id = ?
  `, [
    descricao,
    valor,
    data_movimento,
    categoria || null,
    forma_pagamento || null,
    documento || null,
    vencimento || data_movimento,
    observacao || null,
    pessoa_nome || null,
    status || null,
    status || null,
    id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Movimentação atualizada com sucesso' });
  });
});

router.post('/:id/baixar', (req, res) => {
  const { id } = req.params;
  db.get('SELECT id, tipo, status FROM financeiro WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Movimentação não encontrada.' });
      return;
    }
    const novoStatus = row.tipo === 'receita' ? 'recebido' : 'pago';
    db.run(`UPDATE financeiro SET status = ?, baixado_em = DATE('now') WHERE id = ?`, [novoStatus, id], (upErr) => {
      if (upErr) {
        res.status(500).json({ error: upErr.message });
        return;
      }
      res.json({ message: 'Movimentação baixada com sucesso.' });
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM financeiro WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Movimentação não encontrada' });
      return;
    }
    res.json(row);
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT origem FROM financeiro WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Movimentação não encontrada.' });
      return;
    }
    if (row.origem && row.origem !== 'manual') {
      res.status(400).json({ error: 'Movimentações automáticas devem ser removidas na origem (compra/venda).' });
      return;
    }
    db.run('DELETE FROM financeiro WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        res.status(500).json({ error: deleteErr.message });
        return;
      }
      res.json({ message: 'Movimentação deletada com sucesso' });
    });
  });
});

module.exports = router;
