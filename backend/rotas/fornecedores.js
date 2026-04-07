const express = require('express');
const router = express.Router();
const db = require('../database');

// LISTAR TODOS
router.get('/', (req, res) => {
  db.all('SELECT * FROM fornecedores ORDER BY nome ASC', (err, rows) => {
    if (err) {
      console.error('Erro ao listar fornecedores:', err.message);
      return res.status(500).json({ error: 'Erro ao listar fornecedores.' });
    }

    res.json(rows || []);
  });
});

// BUSCAR POR ID
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM fornecedores WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Erro ao buscar fornecedor:', err.message);
      return res.status(500).json({ error: 'Erro ao buscar fornecedor.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Fornecedor não encontrado.' });
    }

    res.json(row);
  });
});

// CRIAR
router.post('/', (req, res) => {
  const {
    nome,
    razao_social,
    cpf_cnpj,
    telefone,
    email,
    contato,
    cep,
    rua,
    numero,
    bairro,
    cidade,
    uf,
    observacoes
  } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: 'O nome do fornecedor é obrigatório.' });
  }

  const nomeLimpo = String(nome).trim();
  const razaoSocialLimpa = razao_social ? String(razao_social).trim() : null;
  const cpfCnpjLimpo = cpf_cnpj ? String(cpf_cnpj).trim() : null;
  const telefoneLimpo = telefone ? String(telefone).trim() : null;
  const emailLimpo = email ? String(email).trim() : null;
  const contatoLimpo = contato ? String(contato).trim() : null;
  const cepLimpo = cep ? String(cep).trim() : null;
  const ruaLimpa = rua ? String(rua).trim() : null;
  const numeroLimpo = numero ? String(numero).trim() : null;
  const bairroLimpo = bairro ? String(bairro).trim() : null;
  const cidadeLimpa = cidade ? String(cidade).trim() : null;
  const ufLimpa = uf ? String(uf).trim().toUpperCase() : null;
  const observacoesLimpas = observacoes ? String(observacoes).trim() : null;

  db.run(`
    INSERT INTO fornecedores (
      nome,
      razao_social,
      cpf_cnpj,
      telefone,
      email,
      contato,
      cep,
      rua,
      numero,
      bairro,
      cidade,
      uf,
      observacoes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    nomeLimpo,
    razaoSocialLimpa,
    cpfCnpjLimpo,
    telefoneLimpo,
    emailLimpo,
    contatoLimpo,
    cepLimpo,
    ruaLimpa,
    numeroLimpo,
    bairroLimpo,
    cidadeLimpa,
    ufLimpa,
    observacoesLimpas
  ], function (err) {
    if (err) {
      console.error('Erro ao criar fornecedor:', err.message);

      if (err.message.includes('UNIQUE constraint failed: fornecedores.cpf_cnpj')) {
        return res.status(400).json({
          error: 'Já existe um fornecedor com este CPF/CNPJ.'
        });
      }

      return res.status(500).json({
        error: 'Erro ao cadastrar fornecedor: ' + err.message
      });
    }

    res.json({
      id: this.lastID,
      message: 'Fornecedor cadastrado com sucesso.'
    });
  });
});

// ATUALIZAR
router.put('/:id', (req, res) => {
  const { id } = req.params;

  const {
    nome,
    razao_social,
    cpf_cnpj,
    telefone,
    email,
    contato,
    cep,
    rua,
    numero,
    bairro,
    cidade,
    uf,
    observacoes
  } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: 'O nome do fornecedor é obrigatório.' });
  }

  const nomeLimpo = String(nome).trim();
  const razaoSocialLimpa = razao_social ? String(razao_social).trim() : null;
  const cpfCnpjLimpo = cpf_cnpj ? String(cpf_cnpj).trim() : null;
  const telefoneLimpo = telefone ? String(telefone).trim() : null;
  const emailLimpo = email ? String(email).trim() : null;
  const contatoLimpo = contato ? String(contato).trim() : null;
  const cepLimpo = cep ? String(cep).trim() : null;
  const ruaLimpa = rua ? String(rua).trim() : null;
  const numeroLimpo = numero ? String(numero).trim() : null;
  const bairroLimpo = bairro ? String(bairro).trim() : null;
  const cidadeLimpa = cidade ? String(cidade).trim() : null;
  const ufLimpa = uf ? String(uf).trim().toUpperCase() : null;
  const observacoesLimpas = observacoes ? String(observacoes).trim() : null;

  db.run(`
    UPDATE fornecedores SET
      nome = ?,
      razao_social = ?,
      cpf_cnpj = ?,
      telefone = ?,
      email = ?,
      contato = ?,
      cep = ?,
      rua = ?,
      numero = ?,
      bairro = ?,
      cidade = ?,
      uf = ?,
      observacoes = ?
    WHERE id = ?
  `, [
    nomeLimpo,
    razaoSocialLimpa,
    cpfCnpjLimpo,
    telefoneLimpo,
    emailLimpo,
    contatoLimpo,
    cepLimpo,
    ruaLimpa,
    numeroLimpo,
    bairroLimpo,
    cidadeLimpa,
    ufLimpa,
    observacoesLimpas,
    id
  ], function (err) {
    if (err) {
      console.error('Erro ao atualizar fornecedor:', err.message);

      if (err.message.includes('UNIQUE constraint failed: fornecedores.cpf_cnpj')) {
        return res.status(400).json({
          error: 'Já existe outro fornecedor com este CPF/CNPJ.'
        });
      }

      return res.status(500).json({
        error: 'Erro ao atualizar fornecedor: ' + err.message
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Fornecedor não encontrado.' });
    }

    res.json({ message: 'Fornecedor atualizado com sucesso.' });
  });
});

// EXCLUIR
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM fornecedores WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Erro ao excluir fornecedor:', err.message);
      return res.status(500).json({ error: 'Erro ao excluir fornecedor.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Fornecedor não encontrado.' });
    }

    res.json({ message: 'Fornecedor excluído com sucesso.' });
  });
});

module.exports = router;