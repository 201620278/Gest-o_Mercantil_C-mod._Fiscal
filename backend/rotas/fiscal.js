const express = require('express');
const router = express.Router();

const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('../database');
const fiscalService = require('../services/fiscalService');
const certificadoService = require('../services/certificadoService');

const uploadTempDir = path.join(__dirname, '..', 'storage', 'temp-certificados');

if (!fs.existsSync(uploadTempDir)) {
  fs.mkdirSync(uploadTempDir, { recursive: true });
}

const uploadCertificado = multer({
  dest: uploadTempDir,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

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
    FROM empresa_fiscal
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

  const erros = [];

  const somenteNumeros = (v) => String(v || '').replace(/\D/g, '');

  const cnpjLimpo = somenteNumeros(cnpj);

  if (!cnpjLimpo || cnpjLimpo.length !== 14) {
    erros.push('CNPJ inválido');
  }

  if (!razao_social) {
    erros.push('Razão social obrigatória');
  }

  if (!nome_fantasia) {
    erros.push('Nome fantasia obrigatório');
  }

  if (!ie) {
    erros.push('Inscrição Estadual obrigatória');
  }

  if (!uf) {
    erros.push('UF obrigatória');
  }

  if (!municipio) {
    erros.push('Município obrigatório');
  }

  const cscFinal = CSC || csc || '';
  const cscIdFinal = CSC_ID || csc_id || '';

  if (!cscFinal) {
    erros.push('CSC obrigatório');
  }

  if (!cscIdFinal) {
    erros.push('CSC ID obrigatório');
  }

  if (erros.length > 0) {
    res.status(400).json({
      error: 'Erro na configuração fiscal',
      detalhes: erros
    });
    return;
  }

  // verificar se já existe configuração
  db.get(`SELECT id FROM empresa_fiscal LIMIT 1`, [], (err, existente) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    if (existente) {
      // UPDATE
      db.run(`
        UPDATE empresa_fiscal SET
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
        cnpjLimpo,
        razao_social,
        nome_fantasia,
        ie,
        crt || 1,
        logradouro || '',
        numero || '',
        complemento || '',
        bairro || '',
        codigo_municipio || '',
        municipio,
        uf,
        cep || '',
        cnae_principal || '',
        ambiente || 'homologacao',
        Number(serie_nfce || 1),
        Number(proximo_numero_nfce || 1),
        cscFinal,
        cscIdFinal,
        existente.id
      ], function(errUpdate) {
        if (errUpdate) {
          tratarErro(res, errUpdate);
          return;
        }

        res.json({
          success: true,
          message: 'Configuração fiscal atualizada com sucesso'
        });
      });

    } else {
      // INSERT
      db.run(`
        INSERT INTO empresa_fiscal (
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
        cnpjLimpo,
        razao_social,
        nome_fantasia,
        ie,
        crt || 1,
        logradouro || '',
        numero || '',
        complemento || '',
        bairro || '',
        codigo_municipio || '',
        municipio,
        uf,
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
          message: 'Configuração fiscal salva com sucesso'
        });
      });
    }
  });
});

// Upload do certificado digital
router.post('/config/certificado', uploadCertificado.single('certificado'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo do certificado não enviado.' });
      return;
    }

    const senha = req.body?.senha;

    const salvo = certificadoService.salvarArquivoCertificado(req.file);
    const validacao = certificadoService.validarCertificadoPfx(salvo.filePath, senha);

    if (!validacao.ok) {
      try {
        fs.unlinkSync(salvo.filePath);
      } catch (_) {}

      res.status(400).json(validacao);
      return;
    }

    db.get(`SELECT id FROM empresa_fiscal LIMIT 1`, [], (err, existente) => {
      if (err) {
        tratarErro(res, err);
        return;
      }

      if (!existente) {
        res.status(400).json({
          error: 'Cadastre primeiro a configuração fiscal da empresa antes de enviar o certificado.'
        });
        return;
      }

      db.run(`
        UPDATE empresa_fiscal
        SET
          certificado_path = ?,
          certificado_senha = ?,
          certificado_validade_inicio = ?,
          certificado_validade_fim = ?,
          certificado_serial = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [
        salvo.filePath,
        senha,
        validacao.info.validFrom,
        validacao.info.validTo,
        validacao.info.serialNumber,
        existente.id
      ], function(errUpdate) {
        if (errUpdate) {
          tratarErro(res, errUpdate);
          return;
        }

        res.json({
          success: true,
          message: 'Certificado validado e salvo com sucesso.',
          certificado: {
            fileName: salvo.fileName,
            filePath: salvo.filePath,
            serialNumber: validacao.info.serialNumber,
            validFrom: validacao.info.validFrom,
            validTo: validacao.info.validTo,
            subject: validacao.info.subject,
            issuer: validacao.info.issuer
          }
        });
      });
    });
  } catch (error) {
    tratarErro(res, error);
  }
});

// Testar certificado salvo
router.get('/config/certificado/testar', (req, res) => {
  db.get(`
    SELECT
      certificado_path,
      certificado_senha,
      certificado_validade_inicio,
      certificado_validade_fim,
      certificado_serial
    FROM empresa_fiscal
    ORDER BY id DESC
    LIMIT 1
  `, [], (err, row) => {
    if (err) {
      tratarErro(res, err);
      return;
    }

    if (!row || !row.certificado_path) {
      res.status(404).json({ error: 'Nenhum certificado configurado.' });
      return;
    }

    const resultado = certificadoService.validarCertificadoPfx(
      row.certificado_path,
      row.certificado_senha
    );

    if (!resultado.ok) {
      res.status(400).json(resultado);
      return;
    }

    res.json({
      success: true,
      message: 'Certificado válido.',
      certificado: {
        serialNumber: resultado.info.serialNumber,
        validFrom: resultado.info.validFrom,
        validTo: resultado.info.validTo,
        subject: resultado.info.subject,
        issuer: resultado.info.issuer
      }
    });
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