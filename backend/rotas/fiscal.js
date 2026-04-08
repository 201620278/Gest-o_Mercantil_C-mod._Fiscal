const express = require('express');
const router = express.Router();

const db = require('../database');
const fiscalService = require('../services/fiscalService');

function tratarErro(res, error) {
  console.error('[FISCAL]', error);
  res.status(500).json({
    error: error.message || 'Erro interno no módulo fiscal.'
  });
}

//
// CONFIGURAÇÃO FISCAL
//

// Buscar a configuração fiscal mais recente
router.get('/config', (req, res) => {
  db.get(`
    SELECT *
    FROM configuracao_fiscal
    ORDER BY id DESC
    LIMIT 1
  `, [], (err, row) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    res.json(row || {});
  });
});

// Salvar nova configuração fiscal
router.post('/config', (req, res) => {
  const {
    cnpj,
    razao_social,
    nome_fantasia,
    ie,
    crt,
    logradouro,
    numero,
    complemento,
    bairro,
    codigo_municipio,
    municipio,
    uf,
    cep,
    cnae_principal,
    ambiente,
    serie_nfce,
    proximo_numero_nfce,
    CSC,
    CSC_ID,
    csc,
    csc_id
  } = req.body || {};

  const cscFinal = CSC || csc || '';
  const cscIdFinal = CSC_ID || csc_id || '';

  // Verificar se já existe configuração
  db.get(`SELECT id FROM configuracao_fiscal ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    const existe = !!row;

    if (existe) {
      // UPDATE
      db.run(`
        UPDATE configuracao_fiscal
        SET
          cnpj = ?,
          razao_social = ?,
          nome_fantasia = ?,
          ie = ?,
          crt = ?,
          logradouro = ?,
          numero = ?,
          complemento = ?,
          bairro = ?,
          codigo_municipio = ?,
          municipio = ?,
          uf = ?,
          cep = ?,
          cnae_principal = ?,
          ambiente = ?,
          serie_nfce = ?,
          proximo_numero_nfce = ?,
          CSC = ?,
          CSC_ID = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [
        cnpj || '',
        razao_social || '',
        nome_fantasia || '',
        ie || '',
        crt || 1,
        logradouro || '',
        numero || '',
        complemento || '',
        bairro || '',
        codigo_municipio || '',
        municipio || '',
        uf || '',
        cep || '',
        cnae_principal || '',
        ambiente || 'homologacao',
        Number(serie_nfce || 1),
        Number(proximo_numero_nfce || 1),
        cscFinal,
        cscIdFinal,
        row.id
      ], function(errUpdate) {
        if (errUpdate) {
          tratarErro(res, errUpdate);
          return;
        }
        res.json({
          success: true,
          id: row.id,
          message: 'Configuração fiscal atualizada com sucesso.'
        });
      });
    } else {
      // INSERT
      db.run(`
        INSERT INTO configuracao_fiscal (
          cnpj,
          razao_social,
          nome_fantasia,
          ie,
          crt,
          logradouro,
          numero,
          complemento,
          bairro,
          codigo_municipio,
          municipio,
          uf,
          cep,
          cnae_principal,
          ambiente,
          serie_nfce,
          proximo_numero_nfce,
          CSC,
          CSC_ID,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        cnpj || '',
        razao_social || '',
        nome_fantasia || '',
        ie || '',
        crt || 1,
        logradouro || '',
        numero || '',
        complemento || '',
        bairro || '',
        codigo_municipio || '',
        municipio || '',
        uf || '',
        cep || '',
        cnae_principal || '',
        ambiente || 'homologacao',
        Number(serie_nfce || 1),
        Number(proximo_numero_nfce || 1),
        cscFinal,
        cscIdFinal
      ], function(errInsert) {
        if (errInsert) {
          tratarErro(res, errInsert);
          return;
        }
        res.json({
          success: true,
          id: this.lastID,
          message: 'Configuração fiscal criada com sucesso.'
        });
      });
    }
  });
});

//
// NFC-e
//

// Validar se a venda está pronta para NFC-e
router.get('/nfce/validar/:vendaId', async (req, res) => {
  try {
    const vendaId = Number(req.params.vendaId);

    if (!vendaId) {
      res.status(400).json({ error: 'ID da venda inválido.' });
      return;
    }

    const resultado = await fiscalService.validarVendaParaNfce(vendaId);
    res.json(resultado);
  } catch (error) {
    tratarErro(res, error);
  }
});

// Emitir NFC-e
router.post('/nfce/emitir/:vendaId', async (req, res) => {
  try {
    const vendaId = Number(req.params.vendaId);

    if (!vendaId) {
      res.status(400).json({ error: 'ID da venda inválido.' });
      return;
    }

    const resultado = await fiscalService.emitirNfce(vendaId);
    res.json(resultado);
  } catch (error) {
    console.error('[EMITIR NFC-E]', error);

    if (error.validationErrors) {
      res.status(400).json({
        error: error.message,
        validationErrors: error.validationErrors
      });
      return;
    }

    res.status(500).json({
      error: error.message || 'Erro ao emitir NFC-e.'
    });
  }
});

//
// NOTAS FISCAIS
//

// Listar notas fiscais
router.get('/notas', (req, res) => {
  const { status, venda_id, limit } = req.query;

  let sql = `
    SELECT
      nf.*,
      v.cliente_id,
      c.nome AS cliente_nome
    FROM notas_fiscais nf
    LEFT JOIN vendas v ON v.id = nf.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE 1 = 1
  `;

  const params = [];

  if (status) {
    sql += ` AND nf.status = ?`;
    params.push(status);
  }

  if (venda_id) {
    sql += ` AND nf.venda_id = ?`;
    params.push(Number(venda_id));
  }

  sql += ` ORDER BY nf.id DESC`;

  if (limit) {
    sql += ` LIMIT ?`;
    params.push(Number(limit));
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    res.json(rows || []);
  });
});

// Buscar detalhes de uma nota fiscal
router.get('/notas/:id', (req, res) => {
  const notaId = Number(req.params.id);

  if (!notaId) {
    res.status(400).json({ error: 'ID da nota inválido.' });
    return;
  }

  db.get(`
    SELECT
      nf.*,
      v.cliente_id,
      c.nome AS cliente_nome,
      c.cpf_cnpj AS cliente_cpf_cnpj
    FROM notas_fiscais nf
    LEFT JOIN vendas v ON v.id = nf.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE nf.id = ?
  `, [notaId], (err, nota) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    if (!nota) {
      res.status(404).json({ error: 'Nota fiscal não encontrada.' });
      return;
    }

    db.all(`
      SELECT *
      FROM notas_fiscais_eventos
      WHERE nota_fiscal_id = ?
      ORDER BY id DESC
    `, [notaId], (errEventos, eventos) => {
      if (errEventos) {
        tratarErro(res, errEventos);
        return;
      }

      res.json({
        ...nota,
        eventos: eventos || []
      });
    });
  });
});

module.exports = router;