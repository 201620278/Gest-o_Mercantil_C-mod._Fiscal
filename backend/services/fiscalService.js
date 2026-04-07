const fs = require('fs');
const path = require('path');
const db = require('../database');
const sefazService = require('./sefazService');

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

function gerarChaveAcesso(empresa, venda, numero, serie) {
  const cnpj = String(empresa.cnpj || '').replace(/\D/g, '').padStart(14, '0');
  const data = new Date();
  const anoMes = `${String(data.getFullYear()).slice(2)}${pad(data.getMonth() + 1, 2)}`;
  const mod = '65';
  const serieStr = pad(serie, 3);
  const numeroStr = pad(numero, 9);
  const tipoEmissao = '1';
  const cnpjEmitente = cnpj;
  const codigoNum = '12345678';
  return `${anoMes}${cnpjEmitente}${mod}${serieStr}${numeroStr}${tipoEmissao}${codigoNum}0`;
}

function montarXml(venda, notaFiscal, empresa, itens, cliente) {
  const itensXml = itens.map((item, index) => {
    const nItem = index + 1;
    return `
      <det nItem="${nItem}">
        <prod>
          <cProd>${escapeXml(item.produto_id)}</cProd>
          <cEAN>${escapeXml(item.codigo_barras || '')}</cEAN>
          <xProd>${escapeXml(item.nome)}</xProd>
          <NCM>${escapeXml(item.ncm || '')}</NCM>
          <CFOP>${escapeXml(item.cfop || '')}</CFOP>
          <uCom>${escapeXml(item.unidade || 'UN')}</uCom>
          <qCom>${item.quantidade}</qCom>
          <vUnCom>${Number(item.preco_unitario || 0).toFixed(2)}</vUnCom>
          <vProd>${Number(item.subtotal || 0).toFixed(2)}</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>${item.origem || 0}</orig>
              <CST>${escapeXml(item.csosn || '')}</CST>
              <modBC>0</modBC>
              <pICMS>${Number(item.aliquota_icms || 0).toFixed(2)}</pICMS>
              <vICMS>${((item.subtotal || 0) * (item.aliquota_icms || 0) / 100).toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vPIS>${((item.subtotal || 0) * (item.aliquota_pis || 0) / 100).toFixed(2)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vCOFINS>${((item.subtotal || 0) * (item.aliquota_cofins || 0) / 100).toFixed(2)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>`;
  }).join('');

  const clienteXml = cliente ? `
    <dest>
      <CPF>${escapeXml(cliente.cpf_cnpj || '')}</CPF>
      <xNome>${escapeXml(cliente.nome || '')}</xNome>
      <enderDest>
        <xLgr>${escapeXml(cliente.endereco || '')}</xLgr>
      </enderDest>
    </dest>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe>
  <infNFe Id="NFe${notaFiscal.chave_acesso}" versao="4.00">
    <ide>
      <cUF>35</cUF>
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
    </ide>
    <emit>
      <CNPJ>${escapeXml(empresa.cnpj || '')}</CNPJ>
      <xNome>${escapeXml(empresa.razao_social || '')}</xNome>
      <xFant>${escapeXml(empresa.nome_fantasia || '')}</xFant>
      <IE>${escapeXml(empresa.ie || '')}</IE>
      <CRT>${escapeXml(empresa.crt || 1)}</CRT>
      <enderEmit>
        <xLgr>${escapeXml(empresa.logradouro || '')}</xLgr>
        <nro>${escapeXml(empresa.numero || '')}</nro>
        <xBairro>${escapeXml(empresa.bairro || '')}</xBairro>
        <xMun>${escapeXml(empresa.municipio || '')}</xMun>
        <UF>${escapeXml(empresa.uf || '')}</UF>
        <CEP>${escapeXml(empresa.cep || '')}</CEP>
      </enderEmit>
      <CNAE>${escapeXml(empresa.cnae_principal || '')}</CNAE>
    </emit>
    ${clienteXml}
    ${itensXml}
    <total>
      <ICMSTot>
        <vProd>${notaFiscal.valor_total.toFixed(2)}</vProd>
        <vNF>${notaFiscal.valor_total.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
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

function assinarXml(xml, empresa) {
  const assinatura = `\n  <Signature>ASSINADO-PELO-SISTEMA</Signature>`;
  if (xml.includes('</enviNFe>')) {
    return xml.replace('</enviNFe>', `${assinatura}\n</enviNFe>`);
  }
  return xml + assinatura;
}

function inserirEventoNota(notaFiscalId, tipoEvento, protocolo, justificativa, resposta, xmlEventoPath) {
  db.run(`
    INSERT INTO notas_fiscais_eventos (nota_fiscal_id, tipo_evento, protocolo, justificativa, resposta, xml_evento_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [notaFiscalId, tipoEvento, protocolo, justificativa, JSON.stringify(resposta), xmlEventoPath], (err) => {
    if (err) console.error('Erro ao salvar evento de nota fiscal:', err);
  });
}

async function emitirNfce(vendaId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM vendas WHERE id = ?`, [vendaId], (err, venda) => {
      if (err) return reject(err);
      if (!venda) return reject(new Error('Venda não encontrada'));

      db.all(`SELECT vi.*, p.nome, p.ncm, p.cfop, p.csosn, p.origem, p.codigo_barras, p.aliquota_icms, p.aliquota_pis, p.aliquota_cofins, p.unidade
              FROM vendas_itens vi
              JOIN produtos p ON p.id = vi.produto_id
              WHERE vi.venda_id = ?`, [vendaId], (err2, itens) => {
        if (err2) return reject(err2);
        if (!itens || itens.length === 0) {
          return reject(new Error('Venda não possui itens')); 
        }

        db.get(`SELECT * FROM empresa_fiscal ORDER BY id DESC LIMIT 1`, [], (err3, empresa) => {
          if (err3) return reject(err3);
          if (!empresa) return reject(new Error('Configuração fiscal não cadastrada'));

          db.get('SELECT * FROM clientes WHERE id = ?', [venda.cliente_id], (err4, cliente) => {
            if (err4) return reject(err4);

            const numero = Number(empresa.proximo_numero_nfce || 1);
            const serie = Number(empresa.serie_nfce || 1);
            const chaveAcesso = gerarChaveAcesso(empresa, venda, numero, serie);
            const valorTotal = itens.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
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

            db.run(`
              INSERT INTO notas_fiscais (venda_id, numero, serie, ambiente, status, data_emissao, chave_acesso, xml_path, xml_assinado_path)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [vendaId, numero, serie, notaFiscal.ambiente, notaFiscal.status, notaFiscal.data_emissao, chaveAcesso, xmlPath, xmlAssinadoPath], function(err5) {
              if (err5) return reject(err5);

              const notaFiscalId = this.lastID;

              sefazService.transmitirNfce(xmlAssinado, notaFiscal.ambiente)
                .then((retorno) => {
                  const statusFinal = retorno.codigo === '100' ? 'autorizado' : 'rejeitado';
                  const nfceEmitida = statusFinal === 'autorizado' ? 1 : 0;
                  const dataAutorizacao = retorno.dataAutorizacao || new Date().toISOString();
                  const retornoXmlPath = salvarXml(retorno.xmlRetorno || '<retorno/>' , `nfce_venda_${vendaId}_n${numero}_retorno`);

                  db.run(`UPDATE notas_fiscais SET status = ?, protocolo = ?, recibo = ?, motivo_retorno = ?, data_autorizacao = ?, updated_at = datetime('now') WHERE id = ?`,
                    [statusFinal, retorno.protocolo, retorno.xmlRetorno || '', retorno.mensagem, dataAutorizacao, notaFiscalId], (err6) => {
                    if (err6) return reject(err6);

                    db.run(`UPDATE vendas SET status_fiscal = ?, chave_nfce = ?, nfce_emitida = ? WHERE id = ?`, [statusFinal, chaveAcesso, nfceEmitida, vendaId], (err7) => {
                      if (err7) return reject(err7);

                      inserirEventoNota(notaFiscalId, 'transmissao', retorno.protocolo, retorno.mensagem, retorno);

                      db.run(`UPDATE empresa_fiscal SET proximo_numero_nfce = ? WHERE id = ?`, [numero + 1, empresa.id], (err8) => {
                        if (err8) return reject(err8);

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
                          protocolo: retorno.protocolo,
                          motivo_retorno: retorno.mensagem,
                          message: statusFinal === 'autorizado' ? 'NFC-e autorizada pela SEFAZ.' : 'NFC-e rejeitada pela SEFAZ.'
                        });
                      });
                    });
                  });
                })
                .catch((erroTransmissao) => {
                  db.run(`UPDATE notas_fiscais SET status = ?, motivo_retorno = ?, updated_at = datetime('now') WHERE id = ?`, ['erro_transmissao', erroTransmissao.message, notaFiscalId], (err6) => {
                    if (err6) console.error('Erro ao atualizar nota fiscal após falha de transmissão:', err6);
                    reject(erroTransmissao);
                  });
                });
            });
          });
        });
      });
    });
  });
}

module.exports = { emitirNfce };
