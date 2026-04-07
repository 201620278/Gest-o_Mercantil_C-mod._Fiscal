
const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar todas as compras
router.get('/', (req, res) => {
  db.all(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM compras_itens WHERE compra_id = c.id) as total_itens
    FROM compras c 
    ORDER BY c.data_compra DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Buscar compra por ID com itens
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM compras WHERE id = ?', [id], (err, compra) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all(`
      SELECT ci.*, p.nome as produto_nome, p.codigo as produto_codigo
      FROM compras_itens ci
      JOIN produtos p ON ci.produto_id = p.id
      WHERE ci.compra_id = ?
    `, [id], (err, itens) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ ...compra, itens });
    });
  });
});

// Criar nova compra
router.post('/', (req, res) => {
  const { nota_fiscal, data_compra, fornecedor, total, itens } = req.body;
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.run(`
      INSERT INTO compras (nota_fiscal, data_compra, fornecedor, total, status)
      VALUES (?, ?, ?, ?, 'concluida')
    `, [nota_fiscal, data_compra, fornecedor, total], function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      const compraId = this.lastID;
      let itensProcessados = 0;
      
      itens.forEach(item => {
        db.run(`
          INSERT INTO compras_itens (compra_id, produto_id, quantidade, preco_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `, [compraId, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.get(
            'SELECT preco_compra, preco_venda FROM produtos WHERE id = ?',
            [item.produto_id],
            (gErr, antigo) => {
              if (gErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: gErr.message });
                return;
              }

              db.run(`
                UPDATE produtos
                SET estoque_atual = estoque_atual + ?,
                    preco_compra = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [item.quantidade, item.preco_unitario, item.produto_id], (uErr) => {
                if (uErr) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: uErr.message });
                  return;
                }

                if (antigo && Number(antigo.preco_compra) !== Number(item.preco_unitario)) {
                  db.run(`
                    INSERT INTO produtos_preco_historico (
                      produto_id, preco_compra_anterior, preco_compra_novo, preco_venda_anterior, preco_venda_novo
                    ) VALUES (?, ?, ?, ?, ?)
                  `, [
                    item.produto_id,
                    antigo.preco_compra,
                    item.preco_unitario,
                    antigo.preco_venda,
                    antigo.preco_venda
                  ], (hErr) => {
                    if (hErr) console.error('Histórico preço (compra):', hErr);
                  });
                }

                itensProcessados++;
                if (itensProcessados === itens.length) {
                  db.run('COMMIT');
                  res.json({ id: compraId, message: 'Compra registrada com sucesso' });
                }
              });
            }
          );
        });
      });
    });
  });
});

// Atualizar compra
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nota_fiscal, data_compra, fornecedor, total, status } = req.body;
  
  db.run(`
    UPDATE compras 
    SET nota_fiscal = ?, data_compra = ?, fornecedor = ?, total = ?, status = ?
    WHERE id = ?
  `, [nota_fiscal, data_compra, fornecedor, total, status, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Compra atualizada com sucesso' });
    });
});

// Deletar compra
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Buscar itens da compra para ajustar estoque
    db.all('SELECT * FROM compras_itens WHERE compra_id = ?', [id], (err, itens) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      let itensProcessados = 0;
      
      itens.forEach(item => {
        db.run(`
          UPDATE produtos 
          SET estoque_atual = estoque_atual - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [item.quantidade, item.produto_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          itensProcessados++;
          if (itensProcessados === itens.length) {
            db.run('DELETE FROM compras WHERE id = ?', [id], (err) => {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }
              db.run('COMMIT');
              res.json({ message: 'Compra deletada com sucesso' });
            });
          }
        });
      });
      
      if (itens.length === 0) {
        db.run('DELETE FROM compras WHERE id = ?', [id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          db.run('COMMIT');
          res.json({ message: 'Compra deletada com sucesso' });
        });
      }
    });
  });
});

module.exports = router;