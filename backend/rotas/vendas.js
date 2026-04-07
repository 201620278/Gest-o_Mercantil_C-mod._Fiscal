const express = require('express');
const router = express.Router();
const db = require('../database');
const moment = require('moment');

// Listar todas as vendas
router.get('/', (req, res) => {
  db.all(`
    SELECT v.*, c.nome as cliente_nome,
      (SELECT COUNT(*) FROM vendas_itens WHERE venda_id = v.id) as total_itens
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.data_venda DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Buscar venda por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT v.*, c.nome as cliente_nome, c.cpf_cnpj as cliente_cpf
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.id = ?
  `, [id], (err, venda) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all(`
      SELECT vi.*, p.nome as produto_nome, p.codigo as produto_codigo, p.unidade
      FROM vendas_itens vi
      JOIN produtos p ON vi.produto_id = p.id
      WHERE vi.venda_id = ?
    `, [id], (err, itens) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ ...venda, itens });
    });
  });
});

// Criar nova venda

// NOVA LÓGICA: Suporte a venda a prazo
router.post('/', (req, res) => {
  const { cliente_id, total, desconto, forma_pagamento, itens, parcelas, primeiro_vencimento, forcar } = req.body;
  const totalNum = Number(total);

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item na venda.' });
    return;
  }
  if (Number.isNaN(totalNum) || totalNum <= 0) {
    res.status(400).json({ error: 'Total inválido.' });
    return;
  }

  // Venda a prazo exige cliente
  if (forma_pagamento === 'prazo') {
    if (!cliente_id) {
      res.status(400).json({ error: 'Cliente obrigatório para venda a prazo.' });
      return;
    }
    // Validar débitos e parcelas vencidas, a menos que forçar esteja ativo
    if (!forcar) {
      const hoje = moment().format('YYYY-MM-DD');
      db.get(`
        SELECT 
          SUM(CASE WHEN status = 'aberto' THEN valor_restante ELSE 0 END) as total_em_aberto,
          COUNT(CASE WHEN status = 'aberto' AND data_vencimento < ? THEN 1 END) as parcelas_vencidas
        FROM contas_receber
        WHERE cliente_id = ?
      `, [hoje, cliente_id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        const totalEmAberto = Number(row?.total_em_aberto || 0);
        const parcelasVencidas = Number(row?.parcelas_vencidas || 0);
        if (totalEmAberto > 0 || parcelasVencidas > 0) {
          // Avisar operador e pedir confirmação
          res.status(409).json({
            aviso: 'Cliente possui débitos em aberto.',
            total_em_aberto: totalEmAberto,
            parcelas_vencidas: parcelasVencidas,
            pode_continuar: true
          });
          return;
        }
        executarVendaPrazo();
      });
      return;
    }
    // Função para executar venda a prazo
    executarVendaPrazo();
    function executarVendaPrazo() {
      const codigo = `VND-${moment().format('YYYYMMDDHHmmss')}`;
      const data_venda = moment().format('YYYY-MM-DD');
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`
          INSERT INTO vendas (codigo, data_venda, cliente_id, total, desconto, forma_pagamento, status)
          VALUES (?, ?, ?, ?, ?, ?, 'concluida')
        `, [codigo, data_venda, cliente_id, totalNum, desconto || 0, forma_pagamento], function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          const vendaId = this.lastID;
          let itensProcessados = 0;
          itens.forEach(item => {
            db.run(`
              INSERT INTO vendas_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
              VALUES (?, ?, ?, ?, ?)
            `, [vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal], (itemErr) => {
              if (itemErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: itemErr.message });
                return;
              }
              db.run(`
                UPDATE produtos
                SET estoque_atual = estoque_atual - ?
                WHERE id = ?
              `, [item.quantidade, item.produto_id], (estErr) => {
                if (estErr) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: estErr.message });
                  return;
                }
                itensProcessados++;
                if (itensProcessados === itens.length) {
                  // Gerar parcelas
                  const qtdParcelas = Number(parcelas) || 1;
                  const valorParcela = Math.round((totalNum / qtdParcelas) * 100) / 100;
                  let vencimento = moment(primeiro_vencimento, 'YYYY-MM-DD');
                  for (let i = 1; i <= qtdParcelas; i++) {
                    db.run(`
                      INSERT INTO contas_receber (venda_id, cliente_id, numero_parcela, total_parcelas, valor_parcela, valor_restante, data_vencimento, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto')
                    `, [vendaId, cliente_id, i, qtdParcelas, valorParcela, valorParcela, vencimento.format('YYYY-MM-DD')]);
                    vencimento = vencimento.add(1, 'months');
                  }
                  db.run(`
                    INSERT INTO financeiro (tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id, referencia_tipo)
                    VALUES ('receita', 'Venda a prazo #' || ?, ?, ?, 'vendas', ?, ?, 'venda')
                  `, [codigo, totalNum, data_venda, forma_pagamento, vendaId], (finErr) => {
                    if (finErr) {
                      db.run('ROLLBACK');
                      res.status(500).json({ error: finErr.message });
                      return;
                    }
                    db.run('COMMIT');
                    res.json({ id: vendaId, codigo, message: 'Venda a prazo registrada com sucesso' });
                  });
                }
              });
            });
          });
        });
      });
    }
    return;
  }

  // Venda à vista ou crédito antigo
  const executarVenda = () => {
    const codigo = `VND-${moment().format('YYYYMMDDHHmmss')}`;
    const data_venda = moment().format('YYYY-MM-DD');
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`
        INSERT INTO vendas (codigo, data_venda, cliente_id, total, desconto, forma_pagamento, status)
        VALUES (?, ?, ?, ?, ?, ?, 'concluida')
      `, [codigo, data_venda, cliente_id || null, totalNum, desconto || 0, forma_pagamento], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        const vendaId = this.lastID;
        let itensProcessados = 0;
        itens.forEach(item => {
          db.run(`
            INSERT INTO vendas_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
            VALUES (?, ?, ?, ?, ?)
          `, [vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal], (itemErr) => {
            if (itemErr) {
              db.run('ROLLBACK');
              res.status(500).json({ error: itemErr.message });
              return;
            }
            db.run(`
              UPDATE produtos
              SET estoque_atual = estoque_atual - ?
              WHERE id = ?
            `, [item.quantidade, item.produto_id], (estErr) => {
              if (estErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: estErr.message });
                return;
              }
              itensProcessados++;
              if (itensProcessados === itens.length) {
                db.run(`
                  INSERT INTO financeiro (tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id, referencia_tipo)
                  VALUES ('receita', 'Venda #' || ?, ?, ?, 'vendas', ?, ?, 'venda')
                `, [codigo, totalNum, data_venda, forma_pagamento, vendaId], (finErr) => {
                  if (finErr) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: finErr.message });
                    return;
                  }
                  db.run('COMMIT');
                  res.json({ id: vendaId, codigo, message: 'Venda registrada com sucesso' });
                });
              }
            });
          });
        });
      });
    });
  };

  // Venda à vista pode ser sem cliente
  if (forma_pagamento === 'credito') {
    if (!cliente_id) {
      res.status(400).json({ error: 'Cliente obrigatório para venda a crédito.' });
      return;
    }
    db.get(
      'SELECT credito_atual, limite_credito FROM clientes WHERE id = ?',
      [cliente_id],
      (err, cliente) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!cliente) {
          res.status(400).json({ error: 'Cliente não encontrado.' });
          return;
        }
        if (Number(cliente.limite_credito) <= 0) {
          res.status(400).json({ error: 'Configure um limite de crédito maior que zero para este cliente.' });
          return;
        }
        if (Number(cliente.credito_atual) + totalNum > Number(cliente.limite_credito)) {
          res.status(400).json({ error: 'Limite de crédito excedido.' });
          return;
        }
        executarVenda();
      }
    );
  } else {
    executarVenda();
  }
});

// Cancelar venda
router.put('/:id/cancelar', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM vendas WHERE id = ?', [id], (err, venda) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!venda) {
      res.status(404).json({ error: 'Venda não encontrada.' });
      return;
    }
    if (venda.status !== 'concluida') {
      res.status(400).json({ error: 'Apenas vendas concluídas podem ser canceladas.' });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.all('SELECT * FROM vendas_itens WHERE venda_id = ?', [id], (itErr, itens) => {
        if (itErr) {
          db.run('ROLLBACK');
          res.status(500).json({ error: itErr.message });
          return;
        }

        const finalizarCancelamento = () => {
          db.run(`
            UPDATE vendas
            SET status = 'cancelada'
            WHERE id = ?
          `, [id], (upErr) => {
            if (upErr) {
              db.run('ROLLBACK');
              res.status(500).json({ error: upErr.message });
              return;
            }

            db.run(`
              INSERT INTO financeiro (tipo, descricao, valor, data_movimento, categoria, forma_pagamento, referencia_id, referencia_tipo)
              VALUES ('despesa', ?, ?, ?, 'estorno_venda', 'estorno', ?, 'estorno_venda')
            `, [
              `Estorno cancelamento ${venda.codigo}`,
              venda.total,
              venda.data_venda,
              id
            ], (finErr) => {
              if (finErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: finErr.message });
                return;
              }

              if (venda.forma_pagamento === 'credito' && venda.cliente_id) {
                db.run(`
                  UPDATE clientes
                  SET credito_atual = CASE
                    WHEN (credito_atual - ?) < 0 THEN 0
                    ELSE credito_atual - ?
                  END
                  WHERE id = ?
                `, [venda.total, venda.total, venda.cliente_id], (credErr) => {
                  if (credErr) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: credErr.message });
                    return;
                  }
                  db.run('COMMIT');
                  res.json({ message: 'Venda cancelada com sucesso' });
                });
              } else {
                db.run('COMMIT');
                res.json({ message: 'Venda cancelada com sucesso' });
              }
            });
          });
        };

        if (!itens || itens.length === 0) {
          finalizarCancelamento();
          return;
        }

        let itensProcessados = 0;

        itens.forEach(item => {
          db.run(`
            UPDATE produtos
            SET estoque_atual = estoque_atual + ?
            WHERE id = ?
          `, [item.quantidade, item.produto_id], (estErr) => {
            if (estErr) {
              db.run('ROLLBACK');
              res.status(500).json({ error: estErr.message });
              return;
            }

            itensProcessados++;
            if (itensProcessados === itens.length) {
              finalizarCancelamento();
            }
          });
        });
      });
    });
  });
});

// Relatório de vendas por período
router.get('/relatorio/periodo', (req, res) => {
  const { data_inicio, data_fim } = req.query;
  
  db.all(`
    SELECT 
      DATE(data_venda) as data,
      COUNT(*) as total_vendas,
      SUM(total) as valor_total,
      AVG(total) as valor_medio,
      SUM(CASE WHEN cliente_id IS NOT NULL THEN 1 ELSE 0 END) as vendas_com_cliente
    FROM vendas
    WHERE status = 'concluida'
      AND data_venda BETWEEN ? AND ?
    GROUP BY DATE(data_venda)
    ORDER BY data DESC
  `, [data_inicio, data_fim], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;