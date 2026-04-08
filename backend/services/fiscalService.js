const fs = require('fs');
const path = require('path');
const db = require('../database');
const sefazService = require('./sefazService');
const { SignedXml } = require('xml-crypto');
const certificadoService = require('./certificadoService');

const storageDir = path.join(__dirname, '..', 'storage');
const xmlDir = path.join(storageDir, 'xml');
const xmlNfceDir = path.join(xmlDir, 'nfce');

function ensureDirectories() {
  if (!fs.existsSync(xmlNfceDir)) {
    fs.mkdirSync(xmlNfceDir, { recursive: true });
  }
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function somenteNumeros(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatarValor(value) {
  return Number(value || 0).toFixed(2);
}

function gerarChaveAcesso(empresa, venda, numero, serie) {
  const cnpj = somenteNumeros(empresa.cnpj).padStart(14, '0');
  const data = new Date();
  const anoMes = `${String(data.getFullYear()).slice(2)}${pad(data.getMonth() + 1, 2)}`;
  const mod = '65';
  const serieStr = pad(serie, 3);
  const numeroStr = pad(numero, 9);
  const tipoEmissao = '1';
  const codigoNum = '12345678';

  // Mantido simples como no seu projeto atual
  return `${anoMes}${cnpj}${mod}${serieStr}${numeroStr}${tipoEmissao}${codigoNum}0`;
}

function obterCodigoUF(uf) {
  const mapa = {
    RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
    MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
    MG: '31', ES: '32', RJ: '33', SP: '35',
    PR: '41', SC: '42', RS: '43',
    MS: '50', MT: '51', GO: '52', DF: '53'
  };

  return mapa[String(uf || '').toUpperCase()] || '23';
}

function montarXml(venda, notaFiscal, empresa, itens, cliente) {
  const itensXml = itens.map((item, index) => {
    const nItem = index + 1;
    const subtotal = Number(item.subtotal || 0);
    const aliquotaIcms = Number(item.aliquota_icms || 0);
    const aliquotaPis = Number(item.aliquota_pis || 0);
    const aliquotaCofins = Number(item.aliquota_cofins || 0);

    return `
      <det nItem="${nItem}">
        <prod>
          <cProd>${escapeXml(item.produto_id)}</cProd>
          <cEAN>${escapeXml(item.codigo_barras || '')}</cEAN>
          <xProd>${escapeXml(item.nome || '')}</xProd>
          <NCM>${escapeXml(item.ncm || '')}</NCM>
          <CFOP>${escapeXml(item.cfop || '')}</CFOP>
          <uCom>${escapeXml(item.unidade || 'UN')}</uCom>
          <qCom>${formatarValor(item.quantidade)}</qCom>
          <vUnCom>${formatarValor(item.preco_unitario)}</vUnCom>
          <vProd>${formatarValor(subtotal)}</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>${Number(item.origem || 0)}</orig>
              <CST>${escapeXml(item.csosn || '')}</CST>
              <modBC>0</modBC>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pICMS>${formatarValor(aliquotaIcms)}</pICMS>
              <vICMS>${formatarValor((subtotal * aliquotaIcms) / 100)}</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pPIS>${formatarValor(aliquotaPis)}</pPIS>
              <vPIS>${formatarValor((subtotal * aliquotaPis) / 100)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pCOFINS>${formatarValor(aliquotaCofins)}</pCOFINS>
              <vCOFINS>${formatarValor((subtotal * aliquotaCofins) / 100)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>`;
  }).join('');

  let clienteXml = '';
  if (cliente) {
    const doc = somenteNumeros(cliente.cpf_cnpj);

    clienteXml = `
    <dest>
      ${doc.length === 14 ? `<CNPJ>${escapeXml(doc)}</CNPJ>` : ''}
      ${doc.length === 11 ? `<CPF>${escapeXml(doc)}</CPF>` : ''}
      <xNome>${escapeXml(cliente.nome || '')}</xNome>
    </dest>`;
  }

  const cUF = obterCodigoUF(empresa.uf);
  const csc = empresa.CSC || empresa.csc || '';
  const cscId = empresa.CSC_ID || empresa.csc_id || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe>
  <infNFe Id="NFe${notaFiscal.chave_acesso}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${pad(notaFiscal.numero, 8)}</cNF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>${notaFiscal.serie}</serie>
      <nNF>${notaFiscal.numero}</nNF>
      <dhEmi>${new Date().toISOString()}</dhEmi>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${notaFiscal.chave_acesso.slice(-1)}</cDV>
      <tpAmb>${notaFiscal.ambiente === 'producao' ? 1 : 2}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0.0</verProc>
    </ide>
    <emit>
      <CNPJ>${escapeXml(somenteNumeros(empresa.cnpj || ''))}</CNPJ>
      <xNome>${escapeXml(empresa.razao_social || '')}</xNome>
      <xFant>${escapeXml(empresa.nome_fantasia || '')}</xFant>
      <IE>${escapeXml(empresa.ie || '')}</IE>
      <CRT>${escapeXml(empresa.crt || 1)}</CRT>
      <enderEmit>
        <xLgr>${escapeXml(empresa.logradouro || '')}</xLgr>
        <nro>${escapeXml(empresa.numero || '')}</nro>
        <xCpl>${escapeXml(empresa.complemento || '')}</xCpl>
        <xBairro>${escapeXml(empresa.bairro || '')}</xBairro>
        <cMun>${escapeXml(empresa.codigo_municipio || '')}</cMun>
        <xMun>${escapeXml(empresa.municipio || '')}</xMun>
        <UF>${escapeXml(empresa.uf || '')}</UF>
        <CEP>${escapeXml(somenteNumeros(empresa.cep || ''))}</CEP>
      </enderEmit>
      <CNAE>${escapeXml(empresa.cnae_principal || '')}</CNAE>
    </emit>
    ${clienteXml}
    ${itensXml}
    <total>
      <ICMSTot>
        <vProd>${formatarValor(notaFiscal.valor_total)}</vProd>
        <vNF>${formatarValor(notaFiscal.valor_total)}</vNF>
      </ICMSTot>
    </total>
    <infAdic>
      <infCpl>CSC ID: ${escapeXml(cscId)} | CSC: ${escapeXml(csc)}</infCpl>
    </infAdic>
  </infNFe>
</enviNFe>`;
}

function salvarXml(conteudo, nomeArquivo) {
  ensureDirectories();
  const fileName = `${nomeArquivo}.xml`;
  const filePath = path.join(xmlNfceDir, fileName);
  fs.writeFileSync(filePath, conteudo, 'utf8');
  return filePath;
}

function limparPem(pem) {
  return String(pem || '')
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r?\n|\r/g, '')
    .trim();
}

function validarConfigCertificado(empresa) {
  if (!empresa) {
    throw new Error('Configuração fiscal não encontrada.');
  }

  if (!empresa.certificado_path || String(empresa.certificado_path).trim() === '') {
    throw new Error('Caminho do certificado não configurado.');
  }

  if (!empresa.certificado_senha || String(empresa.certificado_senha).trim() === '') {
    throw new Error('Senha do certificado não configurada.');
  }
}

function assinarXml(xml, empresa) {
  validarConfigCertificado(empresa);

  const certificado = certificadoService.carregarCertificadoSalvo(
    empresa.certificado_path,
    empresa.certificado_senha
  );

  const pemKey = certificado.pemKey;
  const pemCert = certificado.pemCert;
  const certBase64 = limparPem(pemCert);

  const sig = new SignedXml();

  sig.privateKey = pemKey;
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  });

  sig.keyInfoProvider = {
    getKeyInfo() {
      return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
    }
  };

  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name(.)='infNFe']",
      action: 'after'
    }
  });

  return sig.getSignedXml();
}

function inserirEventoNota(notaFiscalId, tipoEvento, protocolo, justificativa, resposta, xmlEventoPath = null) {
  db.run(`
    INSERT INTO notas_fiscais_eventos (
      nota_fiscal_id, tipo_evento, protocolo, justificativa, resposta, xml_evento_path
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    notaFiscalId,
    tipoEvento,
    protocolo || null,
    justificativa || null,
    JSON.stringify(resposta || {}),
    xmlEventoPath
  ], (err) => {
    if (err) {
      console.error('Erro ao salvar evento de nota fiscal:', err);
    }
  });
}

function buscarConfiguracaoFiscalAtiva() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT *
      FROM configuracao_fiscal
      ORDER BY id DESC
      LIMIT 1
    `, [], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function buscarVendaCompleta(vendaId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT
        v.*,
        c.nome AS cliente_nome,
        c.cpf_cnpj AS cliente_cpf_cnpj
      FROM vendas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = ?
    `, [vendaId], (err, venda) => {
      if (err) return reject(err);
      if (!venda) return resolve(null);

      db.all(`
        SELECT
          vi.*,
          p.nome,
          p.codigo,
          p.ncm,
          p.csosn,
          p.cfop,
          p.unidade,
          p.origem,
          p.codigo_barras,
          p.aliquota_icms,
          p.aliquota_pis,
          p.aliquota_cofins
        FROM vendas_itens vi
        INNER JOIN produtos p ON p.id = vi.produto_id
        WHERE vi.venda_id = ?
      `, [vendaId], async (errItens, itens) => {
        if (errItens) return reject(errItens);

        try {
          const empresa = await buscarConfiguracaoFiscalAtiva();

          resolve({
            venda,
            itens: itens || [],
            empresa,
            cliente: venda.cliente_id ? {
              id: venda.cliente_id,
              nome: venda.cliente_nome,
              cpf_cnpj: venda.cliente_cpf_cnpj
            } : null
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

function validarEmpresaFiscal(empresa) {
  const erros = [];

  if (!empresa) {
    erros.push('Configuração fiscal da empresa não cadastrada');
    return erros;
  }

  if (somenteNumeros(empresa.cnpj).length !== 14) {
    erros.push('CNPJ da empresa inválido');
  }

  if (!empresa.razao_social || String(empresa.razao_social).trim() === '') {
    erros.push('Razão social da empresa não informada');
  }

  if (!empresa.ie || String(empresa.ie).trim() === '') {
    erros.push('Inscrição Estadual da empresa não informada');
  }

  if (!empresa.uf || String(empresa.uf).trim() === '') {
    erros.push('UF da empresa não informada');
  }

  if (!empresa.municipio || String(empresa.municipio).trim() === '') {
    erros.push('Município da empresa não informado');
  }

  const csc = empresa.CSC || empresa.csc;
  const cscId = empresa.CSC_ID || empresa.csc_id;

  if (!csc || String(csc).trim() === '') {
    erros.push('CSC não informado');
  }

  if (!cscId || String(cscId).trim() === '') {
    erros.push('CSC ID não informado');
  }

  return erros;
}

function validarItensFiscal(itens) {
  const erros = [];

  if (!itens || itens.length === 0) {
    erros.push('Venda sem itens');
    return erros;
  }

  itens.forEach((item, index) => {
    const posicao = index + 1;
    const nome = item.nome || `Item ${posicao}`;

    if (!item.ncm || String(item.ncm).trim() === '') {
      erros.push(`${nome}: NCM não informado`);
    }

    if (!item.csosn || String(item.csosn).trim() === '') {
      erros.push(`${nome}: CSOSN não informado`);
    }

    if (!item.cfop || String(item.cfop).trim() === '') {
      erros.push(`${nome}: CFOP não informado`);
    }

    if (!item.unidade || String(item.unidade).trim() === '') {
      erros.push(`${nome}: unidade não informada`);
    }
  });

  return erros;
}

async function validarVendaParaNfce(vendaId) {
  const dados = await buscarVendaCompleta(vendaId);

  if (!dados) {
    return {
      ok: false,
      erros: ['Venda não encontrada']
    };
  }

  const { venda, itens, empresa, cliente } = dados;
  const erros = [];

  erros.push(...validarEmpresaFiscal(empresa));
  erros.push(...validarItensFiscal(itens));

  if (cliente && cliente.cpf_cnpj) {
    const doc = somenteNumeros(cliente.cpf_cnpj);
    if (![11, 14].includes(doc.length)) {
      erros.push('Documento do cliente inválido');
    }
  }

  return {
    ok: erros.length === 0,
    erros,
    venda,
    itens,
    empresa,
    cliente
  };
}

async function emitirNfce(vendaId) {
  const validacao = await validarVendaParaNfce(vendaId);

  if (!validacao.ok) {
    const erro = new Error(`Venda não está pronta para NFC-e: ${validacao.erros.join('; ')}`);
    erro.validationErrors = validacao.erros;
    throw erro;
  }

  const { venda, itens, empresa, cliente } = validacao;

  const numero = Number(empresa.proximo_numero_nfce || 1);
  const serie = Number(empresa.serie_nfce || 1);
  const chaveAcesso = gerarChaveAcesso(empresa, venda, numero, serie);
  const valorTotal = itens.reduce((soma, item) => soma + Number(item.subtotal || 0), 0);

  const notaFiscal = {
    venda_id: vendaId,
    numero,
    serie,
    ambiente: empresa.ambiente || 'homologacao',
    status: 'pendente',
    data_emissao: new Date().toISOString(),
    chave_acesso: chaveAcesso,
    valor_total: valorTotal
  };

  const xml = montarXml(venda, notaFiscal, empresa, itens, cliente);
  const xmlPath = salvarXml(xml, `nfce_venda_${vendaId}_n${numero}`);

  const xmlAssinado = assinarXml(xml, empresa);
  const xmlAssinadoPath = salvarXml(xmlAssinado, `nfce_venda_${vendaId}_n${numero}_assinado`);

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO notas_fiscais (
        venda_id, numero, serie, ambiente, status, data_emissao, chave_acesso, xml_path, xml_assinado_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vendaId,
      numero,
      serie,
      notaFiscal.ambiente,
      notaFiscal.status,
      notaFiscal.data_emissao,
      chaveAcesso,
      xmlPath,
      xmlAssinadoPath
    ], function(errInsert) {
      if (errInsert) return reject(errInsert);

      const notaFiscalId = this.lastID;

      sefazService.transmitirNfce(xmlAssinado, notaFiscal.ambiente)
        .then((retorno) => {
          const statusFinal = retorno.codigo === '100' ? 'autorizado' : 'rejeitado';
          const nfceEmitida = statusFinal === 'autorizado' ? 1 : 0;
          const dataAutorizacao = retorno.dataAutorizacao || new Date().toISOString();
          const retornoXmlPath = salvarXml(
            retorno.xmlRetorno || '<retorno/>',
            `nfce_venda_${vendaId}_n${numero}_retorno`
          );

          db.run(`
            UPDATE notas_fiscais
            SET
              status = ?,
              protocolo = ?,
              recibo = ?,
              motivo_retorno = ?,
              data_autorizacao = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `, [
            statusFinal,
            retorno.protocolo || null,
            retorno.recibo || null,
            retorno.mensagem || null,
            dataAutorizacao,
            notaFiscalId
          ], (errUpdateNota) => {
            if (errUpdateNota) return reject(errUpdateNota);

            db.run(`
              UPDATE vendas
              SET
                status_fiscal = ?,
                chave_nfce = ?,
                nfce_emitida = ?
              WHERE id = ?
            `, [
              statusFinal,
              chaveAcesso,
              nfceEmitida,
              vendaId
            ], (errUpdateVenda) => {
              if (errUpdateVenda) return reject(errUpdateVenda);

              inserirEventoNota(
                notaFiscalId,
                'transmissao',
                retorno.protocolo || null,
                retorno.mensagem || null,
                retorno,
                retornoXmlPath
              );

              db.run(`
                UPDATE configuracao_fiscal
                SET
                  proximo_numero_nfce = ?,
                  updated_at = datetime('now')
                WHERE id = ?
              `, [numero + 1, empresa.id], (errUpdateEmpresa) => {
                if (errUpdateEmpresa) return reject(errUpdateEmpresa);

                resolve({
                  nota_fiscal_id: notaFiscalId,
                  venda_id: vendaId,
                  numero,
                  serie,
                  chave_acesso: chaveAcesso,
                  xml_path: xmlPath,
                  xml_assinado_path: xmlAssinadoPath,
                  retorno_xml_path: retornoXmlPath,
                  status: statusFinal,
                  protocolo: retorno.protocolo || null,
                  motivo_retorno: retorno.mensagem || null,
                  message: statusFinal === 'autorizado'
                    ? 'NFC-e autorizada pela SEFAZ.'
                    : 'NFC-e rejeitada pela SEFAZ.'
                });
              });
            });
          });
        })
        .catch((erroTransmissao) => {
          db.run(`
            UPDATE notas_fiscais
            SET
              status = ?,
              motivo_retorno = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `, [
            'erro_transmissao',
            erroTransmissao.message,
            notaFiscalId
          ], (errFalha) => {
            if (errFalha) {
              console.error('Erro ao atualizar nota fiscal após falha de transmissão:', errFalha);
            }

            reject(erroTransmissao);
          });
        });
    });
  });
}

module.exports = {
  emitirNfce,
  validarVendaParaNfce
};