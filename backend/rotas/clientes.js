const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar todos os clientes
router.get('/', (req, res) => {
  db.all('SELECT * FROM clientes ORDER BY nome', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Vendas do cliente (histórico de compras)
router.get('/:id/vendas', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT v.*, (SELECT COUNT(*) FROM vendas_itens WHERE venda_id = v.id) as total_itens
    FROM vendas v
    WHERE v.cliente_id = ? AND v.status = 'concluida'
    ORDER BY v.data_venda DESC, v.id DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Buscar cliente por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Garante que todos os campos de endereço existam (evita undefined)
    if (row) {
      row.cep = row.cep || '';
      row.rua = row.rua || '';
      row.numero = row.numero || '';
      row.bairro = row.bairro || '';
      row.cidade = row.cidade || '';
      row.uf = row.uf || '';
    }
    res.json(row);
  });
});

// Criar cliente
router.post('/', (req, res) => {
  const { nome, cpf_cnpj, telefone, email, cep, rua, numero, bairro, cidade, uf, limite_credito } = req.body;
  // Validação básica
  if (!nome) {
    return res.status(400).json({ error: 'O campo nome é obrigatório.' });
  }
  // Garante que limite_credito seja número
  let limiteCreditoNum = parseFloat(limite_credito);
  if (isNaN(limiteCreditoNum)) limiteCreditoNum = 0;
  db.run(`
    INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cep, rua, numero, bairro, cidade, uf, limite_credito, credito_atual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [nome, cpf_cnpj, telefone, email, cep, rua, numero, bairro, cidade, uf, limiteCreditoNum],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao criar cliente: ' + err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Cliente criado com sucesso' });
    });
});

// Atualizar cliente
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nome, cpf_cnpj, telefone, email, cep, rua, numero, bairro, cidade, uf, limite_credito } = req.body;
  if (!nome) {
    return res.status(400).json({ error: 'O campo nome é obrigatório.' });
  }
  let limiteCreditoNum = parseFloat(limite_credito);
  if (isNaN(limiteCreditoNum)) limiteCreditoNum = 0;
  db.run(`
    UPDATE clientes 
    SET nome = ?, cpf_cnpj = ?, telefone = ?, email = ?, cep = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, uf = ?, limite_credito = ?
    WHERE id = ?
  `, [nome, cpf_cnpj, telefone, email, cep, rua, numero, bairro, cidade, uf, limiteCreditoNum, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao atualizar cliente: ' + err.message });
        return;
      }
      res.json({ message: 'Cliente atualizado com sucesso' });
    });
});

// Deletar cliente
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  // Verifica se o cliente possui vendas vinculadas (apenas vendas "concluídas" e cliente_id não nulo)
  db.get('SELECT COUNT(*) as total FROM vendas WHERE cliente_id = ? AND status = "concluida"', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row && row.total > 0) {
      res.status(400).json({ error: 'Não é possível excluir o cliente, pois existem vendas vinculadas a este cadastro.' });
      return;
    }
    // Se não houver vendas, pode excluir
    db.run('DELETE FROM clientes WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Cliente deletado com sucesso' });
    });
  });
});

module.exports = router;
