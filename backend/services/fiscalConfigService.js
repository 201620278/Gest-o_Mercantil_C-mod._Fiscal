const db = require('../database');

function somenteNumeros(value) {
  return String(value || '').replace(/\D/g, '');
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function garantirEstruturaConfiguracaoFiscal() {
  const colunas = await all(`PRAGMA table_info(configuracao_fiscal)`);
  const nomes = colunas.map(c => c.name);
  const alteracoes = [
    !nomes.includes('ativo') && `ALTER TABLE configuracao_fiscal ADD COLUMN ativo INTEGER DEFAULT 0`,
    !nomes.includes('certificado_validade_inicio') && `ALTER TABLE configuracao_fiscal ADD COLUMN certificado_validade_inicio TEXT`,
    !nomes.includes('certificado_validade_fim') && `ALTER TABLE configuracao_fiscal ADD COLUMN certificado_validade_fim TEXT`,
    !nomes.includes('certificado_serial') && `ALTER TABLE configuracao_fiscal ADD COLUMN certificado_serial TEXT`
  ].filter(Boolean);

  for (const sql of alteracoes) {
    await run(sql);
  }

  await run(`INSERT OR IGNORE INTO configuracoes (chave, valor, tipo, descricao) VALUES ('ambiente_fiscal_ativo', 'homologacao', 'string', 'Ambiente fiscal ativo para emissão NFC-e')`);
}

async function listarPerfis() {
  await garantirEstruturaConfiguracaoFiscal();
  const rows = await all(`SELECT * FROM configuracao_fiscal ORDER BY CASE WHEN ambiente = 'homologacao' THEN 0 ELSE 1 END, id DESC`);
  const perfis = {};
  for (const row of rows) {
    const perfil = mapPerfil(row);
    if (!perfis[row.ambiente]) perfis[row.ambiente] = perfil;
  }
  const ambienteAtivo = (await get(`SELECT valor FROM configuracoes WHERE chave = 'ambiente_fiscal_ativo'`))?.valor || 'homologacao';
  return {
    ambiente_ativo: ambienteAtivo,
    perfis: {
      homologacao: perfis.homologacao || null,
      producao: perfis.producao || null
    }
  };
}

async function obterPerfil(ambiente) {
  await garantirEstruturaConfiguracaoFiscal();
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const row = await get(`SELECT * FROM configuracao_fiscal WHERE ambiente = ? ORDER BY id DESC LIMIT 1`, [env]);
  return mapPerfil(row);
}

async function obterPerfilAtivo() {
  const config = await listarPerfis();
  return obterPerfil(config.ambiente_ativo || 'homologacao');
}

function normalizarPayload(payload = {}, ambientePadrao = 'homologacao') {
  const ambiente = payload.ambiente === 'producao' ? 'producao' : ambientePadrao;
  return {
    ambiente,
    cnpj: somenteNumeros(payload.cnpj),
    razao_social: String(payload.razao_social || '').trim(),
    nome_fantasia: String(payload.nome_fantasia || '').trim(),
    ie: String(payload.ie || '').trim(),
    crt: Number(payload.crt || 1),
    cnae_principal: String(payload.cnae_principal || '').trim(),
    cep: somenteNumeros(payload.cep),
    logradouro: String(payload.logradouro || '').trim(),
    numero: String(payload.numero || '').trim(),
    complemento: String(payload.complemento || '').trim(),
    bairro: String(payload.bairro || '').trim(),
    municipio: String(payload.municipio || '').trim(),
    codigo_municipio: String(payload.codigo_municipio || '').trim(),
    uf: String(payload.uf || '').trim().toUpperCase(),
    serie_nfce: Number(payload.serie_nfce || 1),
    proximo_numero_nfce: Number(payload.proximo_numero_nfce || 1),
    CSC: String(payload.CSC || payload.csc || payload.csc_token || '').trim(),
    CSC_ID: String(payload.CSC_ID || payload.csc_id || '').trim()
  };
}

function mapPerfil(perfil) {
  if (!perfil) return null;
  return {
    ...perfil,
    csc_token: perfil.CSC,
    csc_id: perfil.CSC_ID
  };
}

function validarPerfil(data) {
  const erros = [];
  if (!data.cnpj || data.cnpj.length !== 14) erros.push('CNPJ inválido');
  if (!data.razao_social) erros.push('Razão social obrigatória');
  if (!data.nome_fantasia) erros.push('Nome fantasia obrigatório');
  if (!data.ie) erros.push('Inscrição Estadual obrigatória');
  if (!data.uf) erros.push('UF obrigatória');
  if (!data.municipio) erros.push('Município obrigatório');
  if (!data.logradouro) erros.push('Logradouro obrigatório');
  if (!data.numero) erros.push('Número obrigatório');
  if (!data.bairro) erros.push('Bairro obrigatório');
  if (!data.codigo_municipio) erros.push('Código IBGE do município obrigatório');
  if (!data.CSC) erros.push('CSC obrigatório');
  if (!data.CSC_ID) erros.push('CSC ID obrigatório');
  return erros;
}

async function salvarPerfil(payload = {}) {
  const data = normalizarPayload(payload, payload.ambiente);
  const erros = validarPerfil(data);
  if (erros.length) {
    const error = new Error('Erro na configuração fiscal');
    error.validationErrors = erros;
    throw error;
  }

  await garantirEstruturaConfiguracaoFiscal();
  const existente = await obterPerfil(data.ambiente);
  if (existente) {
    await run(`UPDATE configuracao_fiscal SET
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
      serie_nfce = ?,
      proximo_numero_nfce = ?,
      CSC = ?,
      CSC_ID = ?,
      updated_at = datetime('now')
      WHERE id = ?`, [
        data.cnpj, data.razao_social, data.nome_fantasia, data.ie, data.crt,
        data.logradouro, data.numero, data.complemento, data.bairro,
        data.codigo_municipio, data.municipio, data.uf, data.cep,
        data.cnae_principal, data.serie_nfce, data.proximo_numero_nfce,
        data.CSC, data.CSC_ID, existente.id
      ]);
    return mapPerfil({ ...existente, ...data });
  }

  const result = await run(`INSERT INTO configuracao_fiscal (
    ambiente, cnpj, razao_social, nome_fantasia, ie, crt, logradouro, numero, complemento,
    bairro, codigo_municipio, municipio, uf, cep, cnae_principal, serie_nfce,
    proximo_numero_nfce, CSC, CSC_ID, ativo, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`, [
    data.ambiente, data.cnpj, data.razao_social, data.nome_fantasia, data.ie, data.crt,
    data.logradouro, data.numero, data.complemento, data.bairro, data.codigo_municipio,
    data.municipio, data.uf, data.cep, data.cnae_principal, data.serie_nfce,
    data.proximo_numero_nfce, data.CSC, data.CSC_ID
  ]);
  return mapPerfil({ id: result.lastID, ...data });
}

async function definirAmbienteAtivo(ambiente) {
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  await garantirEstruturaConfiguracaoFiscal();
  await run(`INSERT OR IGNORE INTO configuracoes (chave, valor, tipo, descricao) VALUES ('ambiente_fiscal_ativo', ?, 'string', 'Ambiente fiscal ativo para emissão NFC-e')`, [env]);
  await run(`UPDATE configuracoes SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = 'ambiente_fiscal_ativo'`, [env]);
  await run(`UPDATE configuracao_fiscal SET ativo = CASE WHEN ambiente = ? THEN 1 ELSE 0 END`, [env]);
  return env;
}

function avaliarProntidaoPerfil(perfil) {
  const pendencias = [];
  if (!perfil) {
    return { ok: false, pendencias: ['Perfil fiscal não cadastrado'] };
  }
  if (!perfil.certificado_path) pendencias.push('Certificado digital não enviado');
  if (!perfil.certificado_senha) pendencias.push('Senha do certificado não cadastrada');
  if (!perfil.CSC && !perfil.csc_token) pendencias.push('CSC não informado');
  if (!perfil.CSC_ID && !perfil.csc_id) pendencias.push('ID CSC não informado');
  if (!perfil.cnpj || perfil.cnpj.length !== 14) pendencias.push('CNPJ inválido');
  if (!perfil.ie) pendencias.push('Inscrição Estadual não informada');
  if (!perfil.codigo_municipio) pendencias.push('Código IBGE do município não informado');
  return { ok: pendencias.length === 0, pendencias };
}

module.exports = {
  garantirEstruturaConfiguracaoFiscal,
  listarPerfis,
  obterPerfil,
  obterPerfilAtivo,
  salvarPerfil,
  definirAmbienteAtivo,
  avaliarProntidaoPerfil,
  normalizarPayload,
  validarPerfil
};
