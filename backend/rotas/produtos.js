
const express = require('express');
const router = express.Router();
const db = require('../database');

// LISTAR PRODUTOS
router.get('/', (req, res) => {
  db.all(`
    SELECT 
      p.*,
      c.nome AS categoria_nome,
      s.nome AS subcategoria_nome
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
    ORDER BY p.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Erro ao listar produtos:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const produtos = rows.map(p => ({
      ...p,
      categoria: p.categoria_nome || p.categoria || '',
      subcategoria: p.subcategoria_nome || ''
    }));

    res.json(produtos);
  });
});

// Buscar produto por código
router.get('/codigo/:codigo', (req, res) => {
  const { codigo } = req.params;
  db.get('SELECT * FROM produtos WHERE codigo = ?', [codigo], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});


// Histórico de preços do produto
router.get('/:id/historico-precos', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT * FROM produtos_preco_historico
    WHERE produto_id = ?
    ORDER BY created_at DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Buscar produto por ID trazendo o nome da categoria
// Buscar produto por ID trazendo o nome da categoria e subcategoria
router.get('/:id', (req, res) => {
  db.get(`
    SELECT 
      p.*, 
      c.nome AS categoria_nome,
      s.nome AS subcategoria_nome
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
    WHERE p.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    res.json({
      ...row,
      categoria: row.categoria_nome || '',
      subcategoria: row.subcategoria_nome || ''
    });
  });
});

// Criar produto
router.post('/', (req, res) => {
  const {
    codigo, nome, categoria_id, subcategoria_id, unidade, preco_compra,
    lucro_percentual, preco_venda, estoque_atual, estoque_minimo, fornecedor,
    ncm, cfop, csosn, origem, cest, codigo_barras,
    aliquota_icms, aliquota_pis, aliquota_cofins
  } = req.body;

  db.run(`
    INSERT INTO produtos (
      codigo, nome, categoria_id, subcategoria_id, unidade,
      preco_compra, lucro_percentual, preco_venda,
      estoque_atual, estoque_minimo, fornecedor,
      ncm, cfop, csosn, origem, cest, codigo_barras,
      aliquota_icms, aliquota_pis, aliquota_cofins
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    codigo, nome, categoria_id, subcategoria_id, unidade,
    preco_compra, lucro_percentual, preco_venda,
    estoque_atual || 0, estoque_minimo || 0, fornecedor,
    ncm, cfop, csosn, origem, cest, codigo_barras,
    aliquota_icms, aliquota_pis, aliquota_cofins
  ],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // Buscar o produto recém-criado já com nomes de categoria e subcategoria
      db.get(`
        SELECT 
          p.*, 
          c.nome AS categoria_nome, 
          s.nome AS subcategoria_nome
        FROM produtos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
        WHERE p.id = ?
      `, [this.lastID], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.json({
          ...row,
          categoria: row.categoria_nome || '',
          subcategoria: row.subcategoria_nome || '',
          message: 'Produto criado com sucesso'
        });
      });
    });
});

// Atualizar produto
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  db.get('SELECT * FROM produtos WHERE id = ?', [id], (err, old) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!old) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    values.push(id);

    db.run(`
      UPDATE produtos
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, values, function(updateErr) {
      if (updateErr) {
        res.status(500).json({ error: updateErr.message });
        return;
      }

      const novoPc = updates.preco_compra !== undefined ? updates.preco_compra : old.preco_compra;
      const novoPv = updates.preco_venda !== undefined ? updates.preco_venda : old.preco_venda;
      const mudouCompra = Number(novoPc) !== Number(old.preco_compra);
      const mudouVenda = Number(novoPv) !== Number(old.preco_venda);

      function responderComProdutoAtualizado() {
        db.get(`
          SELECT 
            p.*,
            c.nome AS categoria_nome,
            s.nome AS subcategoria_nome
          FROM produtos p
          LEFT JOIN categorias c ON c.id = p.categoria_id
          LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
          WHERE p.id = ?
        `, [id], (err2, row) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          res.json({
            ...row,
            categoria: row.categoria_nome || '',
            subcategoria: row.subcategoria_nome || ''
          });
        });
      }

      if (mudouCompra || mudouVenda) {
        db.run(`
          INSERT INTO produtos_preco_historico (
            produto_id, preco_compra_anterior, preco_compra_novo, preco_venda_anterior, preco_venda_novo
          ) VALUES (?, ?, ?, ?, ?)
        `, [id, old.preco_compra, novoPc, old.preco_venda, novoPv], (histErr) => {
          if (histErr) {
            console.error('Erro ao registrar histórico de preços:', histErr);
          }
          responderComProdutoAtualizado();
        });
      } else {
        responderComProdutoAtualizado();
      }
    });
  });
});

// Deletar produto
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM produtos WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Produto deletado com sucesso' });
  });
});

// Buscar produtos com estoque baixo
router.get('/estoque/baixo', (req, res) => {
  db.all(`
    SELECT * FROM produtos 
    WHERE estoque_atual <= estoque_minimo 
    ORDER BY (estoque_atual / NULLIF(estoque_minimo, 0)) ASC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;