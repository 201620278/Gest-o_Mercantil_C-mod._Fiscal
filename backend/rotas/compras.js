const express = require('express');
const router = express.Router();
const db = require('../database');
const moment = require('moment');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function toDate(value, fallback = moment().format('YYYY-MM-DD')) {
  return value ? moment(value).format('YYYY-MM-DD') : fallback;
}

function addMonths(date, months) {
  return moment(date).add(months, 'months').format('YYYY-MM-DD');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function xmlTagValue(xml, tag) {
  const regex = new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? String(match[1]).trim() : '';
}

function createSlugCodigo(nome = '') {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toUpperCase();
}

function parseXmlNotaCompra(xml) {
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/i);
  const fornecedor = xmlTagValue(xml, 'xNome');
  const notaFiscal = xmlTagValue(xml, 'nNF');
  const dataEmissao = xmlTagValue(xml, 'dhEmi') || xmlTagValue(xml, 'dEmi');
  const total = Number(xmlTagValue(xml, 'vNF') || 0);
  const detRegex = /<det\b[^>]*>([\s\S]*?)<\/det>/gi;
  const itens = [];
  let detMatch;
  while ((detMatch = detRegex.exec(xml)) !== null) {
    const bloco = detMatch[1];
    const codigo = xmlTagValue(bloco, 'cProd') || xmlTagValue(bloco, 'cEAN') || '';
    const descricao = xmlTagValue(bloco, 'xProd');
    const unidade = xmlTagValue(bloco, 'uCom') || 'UN';
    const quantidade = Number(xmlTagValue(bloco, 'qCom') || 0);
    const precoUnitario = Number(xmlTagValue(bloco, 'vUnCom') || 0);
    const subtotal = Number(xmlTagValue(bloco, 'vProd') || (quantidade * precoUnitario) || 0);
    const ncm = xmlTagValue(bloco, 'NCM') || '';
    itens.push({
      codigo_barras: codigo,
      produto_nome: descricao,
      unidade,
      quantidade,
      preco_unitario: Number(precoUnitario.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      margem_lucro: 30,
      preco_venda_sugerido: Number((precoUnitario * 1.3).toFixed(2)),
      ncm
    });
  }

  return {
    chave_acesso: chaveMatch ? chaveMatch[1] : '',
    nota_fiscal: notaFiscal,
    fornecedor,
    data_compra: dataEmissao ? moment(dataEmissao).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'),
    total: Number(total.toFixed(2)),
    itens
  };
}

function criarFinanceiroCompra(compra, callback) {
  const {
    id,
    nota_fiscal,
    data_compra,
    fornecedor,
    total,
    condicao_pagamento,
    forma_pagamento,
    data_vencimento,
    parcelas,
    observacao
  } = compra;

  const qtdParcelas = Math.max(1, Number(parcelas) || 1);
  const valorTotal = Number(total) || 0;
  const descricaoBase = `Compra NF ${nota_fiscal || id}${fornecedor ? ` - ${fornecedor}` : ''}`;
  const vencimentoBase = toDate(data_vencimento, data_compra);

  db.run('DELETE FROM financeiro WHERE compra_id = ?', [id], (deleteErr) => {
    if (deleteErr) return callback(deleteErr);

    const inserir = (payload, done) => {
      db.run(`
        INSERT INTO financeiro (
          tipo, descricao, valor, data_movimento, categoria, forma_pagamento,
          referencia_id, referencia_tipo, status, origem, documento, vencimento,
          numero_parcela, total_parcelas, compra_id, pessoa_nome, observacao, baixado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'despesa',
        payload.descricao,
        payload.valor,
        data_compra,
        'compras',
        forma_pagamento || null,
        id,
        'compra',
        payload.status,
        'compra',
        nota_fiscal || null,
        payload.vencimento,
        payload.numero_parcela,
        payload.total_parcelas,
        id,
        fornecedor || null,
        observacao || null,
        payload.status === 'pago' ? data_compra : null
      ], done);
    };

    if (condicao_pagamento === 'parcelado' && qtdParcelas > 1) {
      const valorBase = Math.floor((valorTotal / qtdParcelas) * 100) / 100;
      const resto = Math.round((valorTotal - (valorBase * qtdParcelas)) * 100) / 100;
      let pendentes = qtdParcelas;
      for (let i = 1; i <= qtdParcelas; i++) {
        const valorParcela = Number((valorBase + (i === qtdParcelas ? resto : 0)).toFixed(2));
        inserir({
          descricao: `${descricaoBase} - Parcela ${i}/${qtdParcelas}`,
          valor: valorParcela,
          vencimento: addMonths(vencimentoBase, i - 1),
          numero_parcela: i,
          total_parcelas: qtdParcelas,
          status: 'pendente'
        }, (err) => {
          if (err) return callback(err);
          pendentes -= 1;
          if (pendentes === 0) callback(null);
        });
      }
      return;
    }

    const pagoNaHora = condicao_pagamento === 'avista';
    inserir({
      descricao: descricaoBase,
      valor: valorTotal,
      vencimento: pagoNaHora ? data_compra : vencimentoBase,
      numero_parcela: 1,
      total_parcelas: 1,
      status: pagoNaHora ? 'pago' : 'pendente'
    }, callback);
  });
}

function ensureProductForItem(item, callback) {
  if (item.produto_id) {
    return callback(null, Number(item.produto_id));
  }

  const codigo = item.codigo_barras || createSlugCodigo(item.produto_nome || 'PRODUTO-IMPORTADO');
  const nome = item.produto_nome || `Produto ${codigo}`;

  db.get(
    'SELECT id FROM produtos WHERE codigo = ? OR codigo_barras = ? OR nome = ? LIMIT 1',
    [codigo, codigo, nome],
    (findErr, existente) => {
      if (findErr) return callback(findErr);
      if (existente) return callback(null, existente.id);

      db.run(`
        INSERT INTO produtos (
          codigo, codigo_barras, nome, unidade, preco_compra, preco_venda,
          lucro_percentual, estoque_atual, estoque_minimo, fornecedor, ncm, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, CURRENT_TIMESTAMP)
      `, [
        codigo,
        item.codigo_barras || codigo,
        nome,
        item.unidade || 'UN',
        Number(item.preco_unitario || 0),
        Number(item.preco_venda_sugerido || item.preco_unitario || 0),
        Number(item.margem_lucro || 30),
        item.fornecedor || null,
        item.ncm || null
      ], function(insertErr) {
        if (insertErr) return callback(insertErr);
        callback(null, this.lastID);
      });
    }
  );
}

function processarItensCompra(compraId, itens, fornecedor, done) {
  let index = 0;

  function next() {
    if (index >= itens.length) {
      done(null);
      return;
    }

    const item = itens[index++];
    ensureProductForItem(item, (prodErr, produtoId) => {
      if (prodErr) return done(prodErr);

      db.get('SELECT preco_compra, preco_venda FROM produtos WHERE id = ?', [produtoId], (getErr, antigo) => {
        if (getErr) return done(getErr);

        db.run(`
          INSERT INTO compras_itens (
            compra_id, produto_id, quantidade, preco_unitario, subtotal,
            descricao_produto, codigo_barras, margem_lucro, preco_venda_sugerido, unidade, ncm
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          compraId,
          produtoId,
          Number(item.quantidade || 0),
          Number(item.preco_unitario || 0),
          Number(item.subtotal || 0),
          item.produto_nome || null,
          item.codigo_barras || null,
          Number(item.margem_lucro || 30),
          Number(item.preco_venda_sugerido || 0),
          item.unidade || 'UN',
          item.ncm || null
        ], (insertErr) => {
          if (insertErr) return done(insertErr);

          db.run(`
            UPDATE produtos
            SET estoque_atual = estoque_atual + ?,
                preco_compra = ?,
                preco_venda = ?,
                lucro_percentual = ?,
                fornecedor = COALESCE(?, fornecedor),
                ncm = COALESCE(?, ncm),
                codigo_barras = COALESCE(?, codigo_barras),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            Number(item.quantidade || 0),
            Number(item.preco_unitario || 0),
            Number(item.preco_venda_sugerido || 0),
            Number(item.margem_lucro || 30),
            fornecedor || null,
            item.ncm || null,
            item.codigo_barras || null,
            produtoId
          ], (upErr) => {
            if (upErr) return done(upErr);

            if (antigo && (Number(antigo.preco_compra) !== Number(item.preco_unitario) || Number(antigo.preco_venda) !== Number(item.preco_venda_sugerido || 0))) {
              db.run(`
                INSERT INTO produtos_preco_historico (
                  produto_id, preco_compra_anterior, preco_compra_novo, preco_venda_anterior, preco_venda_novo
                ) VALUES (?, ?, ?, ?, ?)
              `, [produtoId, antigo.preco_compra, item.preco_unitario, antigo.preco_venda, item.preco_venda_sugerido || 0], () => next());
            } else {
              next();
            }
          });
        });
      });
    });
  }

  next();
}

router.post('/importar-xml', upload.single('xml'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Envie um arquivo XML.' });
  }

  try {
    const xml = req.file.buffer.toString('utf-8');
    const nota = parseXmlNotaCompra(xml);
    if (!nota.itens.length) {
      return res.status(400).json({ error: 'Não encontrei itens válidos no XML.' });
    }

    const codigos = nota.itens.map(i => i.codigo_barras).filter(Boolean);
    if (!codigos.length) {
      return res.json(nota);
    }

    const placeholders = codigos.map(() => '?').join(',');
    db.all(`SELECT * FROM produtos WHERE codigo IN (${placeholders}) OR codigo_barras IN (${placeholders})`, [...codigos, ...codigos], (err, produtos) => {
      if (err) return res.status(500).json({ error: err.message });
      const lista = produtos || [];
      nota.itens = nota.itens.map(item => {
        const produto = lista.find(p => [p.codigo, p.codigo_barras].includes(item.codigo_barras));
        return produto ? {
          ...item,
          produto_id: produto.id,
          produto_nome: produto.nome || item.produto_nome,
          unidade: produto.unidade || item.unidade,
          ncm: produto.ncm || item.ncm,
          margem_lucro: Number(produto.lucro_percentual || 30),
          preco_venda_sugerido: Number(produto.preco_venda || (Number(item.preco_unitario || 0) * 1.3)).toFixed(2)
        } : item;
      });
      res.json(nota);
    });
  } catch (error) {
    res.status(400).json({ error: `Erro ao ler XML: ${error.message}` });
  }
});

router.get('/', (req, res) => {
  db.all(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM compras_itens WHERE compra_id = c.id) as total_itens,
      (SELECT COUNT(*) FROM financeiro f WHERE f.compra_id = c.id AND f.status = 'pendente') as parcelas_pendentes
    FROM compras c 
    ORDER BY c.data_compra DESC, c.id DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/por-nota/:nota', (req, res) => {
  db.get('SELECT * FROM compras WHERE nota_fiscal = ? ORDER BY id DESC LIMIT 1', [req.params.nota], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Compra não encontrada.' });
    res.json(row);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM compras WHERE id = ?', [id], (err, compra) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!compra) return res.status(404).json({ error: 'Compra não encontrada.' });

    db.all(`
      SELECT ci.*, COALESCE(p.nome, ci.descricao_produto) as produto_nome, p.codigo as produto_codigo
      FROM compras_itens ci
      LEFT JOIN produtos p ON ci.produto_id = p.id
      WHERE ci.compra_id = ?
      ORDER BY ci.id
    `, [id], (itErr, itens) => {
      if (itErr) return res.status(500).json({ error: itErr.message });
      db.all('SELECT * FROM financeiro WHERE compra_id = ? ORDER BY numero_parcela, vencimento', [id], (finErr, financeiro) => {
        if (finErr) return res.status(500).json({ error: finErr.message });
        res.json({ ...compra, itens, financeiro });
      });
    });
  });
});

router.post('/', (req, res) => {
  const {
    nota_fiscal,
    chave_acesso,
    data_compra,
    fornecedor,
    total,
    itens,
    condicao_pagamento,
    forma_pagamento,
    data_vencimento,
    parcelas,
    observacao
  } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item para a compra.' });
  }

  const totalNum = Number(total);
  if (!Number.isFinite(totalNum) || totalNum <= 0) {
    return res.status(400).json({ error: 'Total da compra inválido.' });
  }

  const condicao = condicao_pagamento || 'avista';
  const qtdParcelas = Math.max(1, Number(parcelas) || 1);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(`
      INSERT INTO compras (
        nota_fiscal, chave_acesso, data_compra, fornecedor, total, status,
        condicao_pagamento, forma_pagamento, data_vencimento, parcelas, observacao, xml_importado_em
      ) VALUES (?, ?, ?, ?, ?, 'concluida', ?, ?, ?, ?, ?, ?)
    `, [
      nota_fiscal || null,
      digitsOnly(chave_acesso) || null,
      data_compra,
      fornecedor || null,
      totalNum,
      condicao,
      forma_pagamento || null,
      data_vencimento || (condicao === 'avista' ? data_compra : null),
      condicao === 'parcelado' ? qtdParcelas : 1,
      observacao || null,
      digitsOnly(chave_acesso) ? moment().format('YYYY-MM-DD HH:mm:ss') : null
    ], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      const compraId = this.lastID;
      processarItensCompra(compraId, itens, fornecedor, (itensErr) => {
        if (itensErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: itensErr.message });
        }

        criarFinanceiroCompra({
          id: compraId,
          nota_fiscal,
          data_compra,
          fornecedor,
          total: totalNum,
          condicao_pagamento: condicao,
          forma_pagamento,
          data_vencimento,
          parcelas: condicao === 'parcelado' ? qtdParcelas : 1,
          observacao
        }, (finErr) => {
          if (finErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: finErr.message });
          }
          db.run('COMMIT');
          res.json({ id: compraId, message: 'Compra registrada com sucesso e integrada ao financeiro.' });
        });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.all('SELECT * FROM compras_itens WHERE compra_id = ?', [id], (err, itens) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      const finalizar = () => {
        db.run('DELETE FROM financeiro WHERE compra_id = ?', [id], (finErr) => {
          if (finErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: finErr.message });
          }
          db.run('DELETE FROM compras WHERE id = ?', [id], (delErr) => {
            if (delErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: delErr.message });
            }
            db.run('COMMIT');
            res.json({ message: 'Compra deletada com sucesso' });
          });
        });
      };

      if (!itens || itens.length === 0) {
        finalizar();
        return;
      }

      let processados = 0;
      itens.forEach(item => {
        db.run(`
          UPDATE produtos
          SET estoque_atual = estoque_atual - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [item.quantidade, item.produto_id], (upErr) => {
          if (upErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: upErr.message });
          }
          processados += 1;
          if (processados === itens.length) finalizar();
        });
      });
    });
  });
});

module.exports = router;
