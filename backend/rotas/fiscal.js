const express = require('express');
const router = express.Router();
const db = require('../database');
const fiscalService = require('../services/fiscalService');

// Config empresa fiscal
router.get('/config', (req, res) => {
  db.get(`SELECT * FROM empresa_fiscal ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

router.post('/config', (req, res) => {
  const {
    razao_social, nome_fantasia, cnpj, ie, crt, cnae_principal,
    cep, logradouro, numero, complemento, bairro, municipio,
    codigo_municipio, uf, ambiente, serie_nfce, proximo_numero_nfce,
    CSC, CSC_ID, certificado_path, certificado_senha
  } = req.body;

  db.run(`
    INSERT INTO empresa_fiscal (
      razao_social, nome_fantasia, cnpj, ie, crt, cnae_principal,
      cep, logradouro, numero, complemento, bairro, municipio,
      codigo_municipio, uf, ambiente, serie_nfce, proximo_numero_nfce,
      CSC, CSC_ID, certificado_path, certificado_senha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    razao_social, nome_fantasia, cnpj, ie, crt, cnae_principal,
    cep, logradouro, numero, complemento, bairro, municipio,
    codigo_municipio, uf, ambiente, serie_nfce, proximo_numero_nfce,
    CSC, CSC_ID, certificado_path, certificado_senha
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Configuração fiscal salva com sucesso' });
  });
});

// Emitir NFC-e de uma venda
router.post('/nfce/emitir/:vendaId', async (req, res) => {
  try {
    const resultado = await fiscalService.emitirNfce(req.params.vendaId);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Consultar nota por venda
router.get('/nfce/venda/:vendaId', (req, res) => {
  db.get(`SELECT * FROM notas_fiscais WHERE venda_id = ?`, [req.params.vendaId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

// Listar todas as notas fiscais
router.get('/nfce', (req, res) => {
  db.all(`
    SELECT nf.*, v.codigo AS venda_codigo, c.nome AS cliente_nome
    FROM notas_fiscais nf
    LEFT JOIN vendas v ON v.id = nf.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    ORDER BY nf.data_emissao DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
