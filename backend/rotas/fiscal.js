const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('../database');
const fiscalService = require('../services/fiscalService');
const certificadoService = require('../services/certificadoService');
const fiscalConfigService = require('../services/fiscalConfigService');

const uploadTempDir = path.join(__dirname, '..', 'storage', 'temp-certificados');
if (!fs.existsSync(uploadTempDir)) fs.mkdirSync(uploadTempDir, { recursive: true });

const uploadCertificado = multer({
  dest: uploadTempDir,
  limits: { fileSize: 5 * 1024 * 1024 }
});

function tratarErro(res, error) {
  console.error('[FISCAL]', error);
  const status = error.validationErrors ? 400 : 500;
  res.status(status).json({
    error: error.message || 'Erro interno no módulo fiscal.',
    validationErrors: error.validationErrors || undefined
  });
}

router.get('/config', async (req, res) => {
  try {
    const data = await fiscalConfigService.listarPerfis();
    const legado = data.perfis[data.ambiente_ativo] || data.perfis.homologacao || data.perfis.producao || {};
    res.json({ ...legado, ambiente_ativo: data.ambiente_ativo, perfis: data.perfis });
  } catch (error) {
    tratarErro(res, error);
  }
});

router.post('/config', async (req, res) => {
  try {
    const ambiente = req.body?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const perfil = await fiscalConfigService.salvarPerfil({ ...req.body, ambiente });
    if (req.body?.ativar === true || req.body?.ativar === 'true') {
      await fiscalConfigService.definirAmbienteAtivo(ambiente);
    }
    res.json({ success: true, message: `Configuração fiscal de ${ambiente} salva com sucesso.`, perfil });
  } catch (error) {
    tratarErro(res, error);
  }
});

router.post('/config/ambiente-ativo', async (req, res) => {
  try {
    const ambiente = await fiscalConfigService.definirAmbienteAtivo(req.body?.ambiente);
    res.json({ success: true, ambiente_ativo: ambiente, message: `Ambiente fiscal ativo alterado para ${ambiente}.` });
  } catch (error) {
    tratarErro(res, error);
  }
});

router.get('/config/prontidao', async (req, res) => {
  try {
    const ambiente = req.query?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const perfil = await fiscalConfigService.obterPerfil(ambiente);
    const prontidao = fiscalConfigService.avaliarProntidaoPerfil(perfil);
    res.json({ ambiente, ...prontidao });
  } catch (error) {
    tratarErro(res, error);
  }
});

router.post('/config/certificado', uploadCertificado.single('certificado'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo do certificado não enviado.' });
    const ambiente = req.body?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const senha = req.body?.senha;
    const perfil = await fiscalConfigService.obterPerfil(ambiente);
    if (!perfil) return res.status(400).json({ error: `Cadastre primeiro o perfil fiscal de ${ambiente}.` });

    const salvo = certificadoService.salvarArquivoCertificado(req.file);
    const validacao = certificadoService.validarCertificadoPfx(salvo.filePath, senha);
    if (!validacao.ok) {
      try { fs.unlinkSync(salvo.filePath); } catch (_) {}
      return res.status(400).json(validacao);
    }

    db.run(`UPDATE configuracao_fiscal SET
      certificado_path = ?,
      certificado_senha = ?,
      certificado_validade_inicio = ?,
      certificado_validade_fim = ?,
      certificado_serial = ?,
      updated_at = datetime('now')
      WHERE id = ?`, [
      salvo.filePath,
      senha,
      validacao.info.validFrom,
      validacao.info.validTo,
      validacao.info.serialNumber,
      perfil.id
    ], function(err) {
      if (err) return tratarErro(res, err);
      res.json({
        success: true,
        ambiente,
        message: `Certificado de ${ambiente} validado e salvo com sucesso.`,
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
  } catch (error) {
    tratarErro(res, error);
  }
});

router.get('/config/certificado/testar', async (req, res) => {
  try {
    const ambiente = req.query?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const perfil = await fiscalConfigService.obterPerfil(ambiente);
    if (!perfil || !perfil.certificado_path) return res.status(404).json({ error: `Nenhum certificado configurado em ${ambiente}.` });
    const resultado = certificadoService.validarCertificadoPfx(perfil.certificado_path, perfil.certificado_senha);
    if (!resultado.ok) return res.status(400).json(resultado);
    res.json({
      success: true,
      ambiente,
      message: 'Certificado válido.',
      certificado: {
        serialNumber: resultado.info.serialNumber,
        validFrom: resultado.info.validFrom,
        validTo: resultado.info.validTo,
        subject: resultado.info.subject,
        issuer: resultado.info.issuer
      }
    });
  } catch (error) {
    tratarErro(res, error);
  }
});

router.get('/nfce/validar/:vendaId', async (req, res) => {
  try {
    const vendaId = Number(req.params.vendaId);
    if (!vendaId) return res.status(400).json({ error: 'ID da venda inválido.' });
    const resultado = await fiscalService.validarVendaParaNfce(vendaId);
    res.json(resultado);
  } catch (error) {
    tratarErro(res, error);
  }
});

router.post('/nfce/emitir/:vendaId', async (req, res) => {
  try {
    const vendaId = Number(req.params.vendaId);
    if (!vendaId) return res.status(400).json({ error: 'ID da venda inválido.' });
    const resultado = await fiscalService.emitirNfce(vendaId);
    res.json(resultado);
  } catch (error) {
    tratarErro(res, error);
  }
});

router.get('/notas', (req, res) => {
  const { status, venda_id, limit } = req.query;
  let sql = `SELECT nf.*, v.cliente_id, c.nome AS cliente_nome FROM notas_fiscais nf LEFT JOIN vendas v ON v.id = nf.venda_id LEFT JOIN clientes c ON c.id = v.cliente_id WHERE 1 = 1`;
  const params = [];
  if (status) { sql += ` AND nf.status = ?`; params.push(status); }
  if (venda_id) { sql += ` AND nf.venda_id = ?`; params.push(Number(venda_id)); }
  sql += ` ORDER BY nf.id DESC`;
  if (limit) { sql += ` LIMIT ?`; params.push(Number(limit)); }
  db.all(sql, params, (err, rows) => {
    if (err) return tratarErro(res, err);
    res.json(rows || []);
  });
});

router.get('/notas/:id', (req, res) => {
  const notaId = Number(req.params.id);
  if (!notaId) return res.status(400).json({ error: 'ID da nota inválido.' });
  db.get(`SELECT nf.*, v.cliente_id, c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj FROM notas_fiscais nf LEFT JOIN vendas v ON v.id = nf.venda_id LEFT JOIN clientes c ON c.id = v.cliente_id WHERE nf.id = ?`, [notaId], (err, nota) => {
    if (err) return tratarErro(res, err);
    if (!nota) return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
    db.all(`SELECT * FROM notas_fiscais_eventos WHERE nota_fiscal_id = ? ORDER BY id DESC`, [notaId], (errEventos, eventos) => {
      if (errEventos) return tratarErro(res, errEventos);
      res.json({ ...nota, eventos: eventos || [] });
    });
  });
});

module.exports = router;
