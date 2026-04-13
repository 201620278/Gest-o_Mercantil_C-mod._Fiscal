const fs = require('fs');
const path = require('path');
const db = require('../database');
const sefazService = require('./sefazService');
const { SignedXml } = require('xml-crypto');
const certificadoService = require('./certificadoService');
const fiscalConfigService = require('./fiscalConfigService');

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
  if (value === null || value === undefined) return '';

  return String(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
}
function somenteNumeros(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatarValor(value) {
  return Number(value || 0).toFixed(2);
}

function formatarDataHoraBrasil() {
  const agora = new Date();
  const offset = -3; // Brasil/CE
  const local = new Date(agora.getTime() + (offset * 60 * 60 * 1000) + (agora.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 19) + '-03:00';
}

function normalizarFormaPagamento(forma) {
  return String(forma || '').trim().toLowerCase();
}

function obterCodigoPagamentoNfce(formaPagamento) {
  const forma = normalizarFormaPagamento(formaPagamento);

  const mapa = {
    dinheiro: '01',
    cheque: '02',
    cartao_credito: '03',
    cartao_debito: '04',
    credito_loja: '05',
    vale_alimentacao: '10',
    vale_refeicao: '11',
    vale_presente: '12',
    vale_combustivel: '13',
    duplicata_mercantil: '14',
    pix: '17',
    boleto: '15',
    sem_pagamento: '90',

    // mapeamentos do seu sistema
    credito: '05',
    prazo: '15'
  };

  return mapa[forma] || '99';
}

function montarPagXml(venda, valorTotal) {
  const formaPagamento = normalizarFormaPagamento(venda.forma_pagamento);
  const tPag = obterCodigoPagamentoNfce(formaPagamento);

  return `
      <pag>
        <detPag>
          <tPag>${tPag}</tPag>
          <vPag>${formatarValor(valorTotal)}</vPag>
        </detPag>
      </pag>`;
}

function calcularDV(chave) {
  let soma = 0;
  let peso = 2;

  for (let i = chave.length - 1; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function gerarChaveAcesso(empresa, numero, serie) {
  const cUF = obterCodigoUF(empresa.uf); // ex: 23
  const data = new Date();
  
  const ano = String(data.getFullYear()).slice(-2);
  const mes = String(data.getMonth() + 1).padStart(2, '0');

  const CNPJ = somenteNumeros(empresa.cnpj).padStart(14, '0');
  const modelo = '65';
  const serieStr = String(serie).padStart(3, '0');
  const numeroStr = String(numero).padStart(9, '0');
  const tpEmis = '1';
  const cNF = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');

  let chaveSemDV =
    cUF +
    ano + mes +
    CNPJ +
    modelo +
    serieStr +
    numeroStr +
    tpEmis +
    cNF;

  const dv = calcularDV(chaveSemDV);

  return chaveSemDV + dv;
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

function montarXml(venda, notaFiscal, empresa, itens, cliente, idLote = '000000000000001', indSinc = 1) {
  const crt = String(empresa.crt || '1').trim();
  const valorTotal = Number(notaFiscal.valor_total || 0);
  const ambienteHomologacao = notaFiscal.ambiente !== 'producao';

  const itensXml = itens.map((item, index) => {
    const nItem = index + 1;
    const subtotal = Number(item.subtotal || 0);
    const cfop = String(item.cfop || '5102').trim();
    const unidade = String(item.unidade || 'UN').trim();
    const csosn = String(item.csosn || '102').trim();

    let icmsXml = '';

    if (crt === '1') {
      icmsXml = `
          <ICMS>
            <ICMSSN102>
              <orig>${Number(item.origem || 0)}</orig>
              <CSOSN>${escapeXml(csosn)}</CSOSN>
            </ICMSSN102>
          </ICMS>`;
    } else {
      const aliquotaIcms = Number(item.aliquota_icms || 0);

      icmsXml = `
          <ICMS>
            <ICMS00>
              <orig>${Number(item.origem || 0)}</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pICMS>${formatarValor(aliquotaIcms)}</pICMS>
              <vICMS>${formatarValor((subtotal * aliquotaIcms) / 100)}</vICMS>
            </ICMS00>
          </ICMS>`;
    }

    const nomeProduto = String(item.nome || '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 120);

    return `
      <det nItem="${nItem}">
        <prod>
          <cProd>${escapeXml(item.produto_id)}</cProd>
          <cEAN>${escapeXml(item.codigo_barras || 'SEM GTIN')}</cEAN>
          <xProd>${
            ambienteHomologacao && index === 0
              ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
              : escapeXml(nomeProduto)
          }</xProd>
          <NCM>${escapeXml(item.ncm || '')}</NCM>
          <CFOP>${escapeXml(cfop)}</CFOP>
          <uCom>${escapeXml(unidade)}</uCom>
          <qCom>${formatarValor(item.quantidade)}</qCom>
          <vUnCom>${formatarValor(item.preco_unitario)}</vUnCom>
          <vProd>${formatarValor(subtotal)}</vProd>
          <cEANTrib>${escapeXml(item.codigo_barras || 'SEM GTIN')}</cEANTrib>
          <uTrib>${escapeXml(unidade)}</uTrib>
          <qTrib>${formatarValor(item.quantidade)}</qTrib>
          <vUnTrib>${formatarValor(item.preco_unitario)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          ${icmsXml}
          <PIS>
            <PISOutr>
              <CST>49</CST>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pPIS>0.00</pPIS>
              <vPIS>0.00</vPIS>
            </PISOutr>
          </PIS>
          <COFINS>
            <COFINSOutr>
              <CST>49</CST>
              <vBC>${formatarValor(subtotal)}</vBC>
              <pCOFINS>0.00</pCOFINS>
              <vCOFINS>0.00</vCOFINS>
            </COFINSOutr>
          </COFINS>
        </imposto>
      </det>`;
  }).join('');

  let clienteXml = '';
  if (cliente && cliente.cpf_cnpj) {
    const doc = somenteNumeros(cliente.cpf_cnpj);

    clienteXml = `
      <dest>
        ${doc.length === 14 ? `<CNPJ>${escapeXml(doc)}</CNPJ>` : ''}
        ${doc.length === 11 ? `<CPF>${escapeXml(doc)}</CPF>` : ''}
        ${cliente.nome ? `<xNome>${escapeXml(cliente.nome)}</xNome>` : ''}
        <indIEDest>9</indIEDest>
      </dest>`;
  }

  const cUF = obterCodigoUF(empresa.uf);
  const dhEmi = formatarDataHoraBrasil();
  const pagXml = montarPagXml(venda, valorTotal);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>${indSinc}</indSinc>
  <NFe>
    <infNFe Id="NFe${notaFiscal.chave_acesso}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${pad(notaFiscal.numero, 8)}</cNF>
        <natOp>VENDA</natOp>
        <mod>65</mod>
        <serie>${notaFiscal.serie}</serie>
        <nNF>${notaFiscal.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${escapeXml(empresa.codigo_municipio || '')}</cMunFG>
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
        <enderEmit>
          <xLgr>${escapeXml(empresa.logradouro || '')}</xLgr>
          <nro>${escapeXml(empresa.numero || '')}</nro>
          ${empresa.complemento ? `<xCpl>${escapeXml(empresa.complemento)}</xCpl>` : ''}
          <xBairro>${escapeXml(empresa.bairro || '')}</xBairro>
          <cMun>${escapeXml(empresa.codigo_municipio || '')}</cMun>
          <xMun>${escapeXml(empresa.municipio || '')}</xMun>
          <UF>${escapeXml(empresa.uf || '')}</UF>
          <CEP>${escapeXml(somenteNumeros(empresa.cep || ''))}</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
          ${empresa.telefone ? `<fone>${escapeXml(somenteNumeros(empresa.telefone))}</fone>` : ''}
        </enderEmit>
        <IE>${escapeXml(empresa.ie || '')}</IE>
        <CRT>${escapeXml(crt)}</CRT>
      </emit>

      ${clienteXml}

      ${itensXml}

      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${formatarValor(valorTotal)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${formatarValor(valorTotal)}</vNF>
        </ICMSTot>
      </total>

      <transp>
        <modFrete>9</modFrete>
      </transp>

      ${pagXml}

      <infAdic>
        <infCpl>Documento emitido por sistema próprio.</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</enviNFe>`;

  let xmlFinal = xml;
  xmlFinal = xmlFinal.replace(/\r?\n|\r/g, '');
  xmlFinal = xmlFinal.replace(/>\s+</g, '><');
  xmlFinal = xmlFinal.replace(/\s{2,}/g, ' ');
  xmlFinal = xmlFinal.trim();

  return xmlFinal;
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

  const sig = new SignedXml({
    privateKey: pemKey,
    publicCert: pemCert,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  });

  sig.getKeyInfoContent = () => {
    return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
  };

  sig.getCertFromKeyInfo = () => null;

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
  });

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
          const empresa = await fiscalConfigService.obterPerfilAtivo();

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
  const chaveAcesso = gerarChaveAcesso(empresa, numero, serie);
  const valorTotal = Number(venda.total || itens.reduce((soma, item) => soma + Number(item.subtotal || 0), 0));

  const notaFiscal = {
    venda_id: vendaId,
    numero,
    serie,
    ambiente: empresa.ambiente || 'homologacao',
    status: 'pendente',
    data_emissao: formatarDataHoraBrasil(),
    chave_acesso: chaveAcesso,
    valor_total: valorTotal
  };

  const loteId = String(Date.now()).padStart(15, '0').slice(-15);
  const xml = montarXml(venda, notaFiscal, empresa, itens, cliente, loteId, 1);
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

      sefazService.transmitirNfce(xmlAssinado, notaFiscal.ambiente, empresa.certificado_path, empresa.certificado_senha)
        .then((retorno) => {
          const statusFinal = ['100', '150'].includes(retorno.codigo)
            ? 'autorizado'
            : ['103', '105'].includes(retorno.codigo)
              ? 'processando'
              : 'rejeitado';
          const nfceEmitida = statusFinal === 'autorizado' ? 1 : 0;
          const dataAutorizacao = retorno.dataAutorizacao || formatarDataHoraBrasil();
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

                const motivoRetorno = retorno.mensagem || retorno.codigo || 'Retorno desconhecido';
                const message = statusFinal === 'autorizado'
                  ? 'NFC-e autorizada pela SEFAZ.'
                  : statusFinal === 'processando'
                    ? `NFC-e em processamento pela SEFAZ: ${motivoRetorno}`
                    : `NFC-e rejeitada pela SEFAZ: ${motivoRetorno}`;

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
                  data_autorizacao: dataAutorizacao,
                  motivo_retorno: retorno.mensagem || null,
                  qr_code_url: retorno.qrCodeUrl || null,
                  qr_code_base64: retorno.qrCodeBase64 || null,
                  message
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
