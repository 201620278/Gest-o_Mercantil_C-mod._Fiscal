let produtosList = [];
let itensCompraAtual = [];
let compraImportadaXml = null;

function loadCompras() {
    $.when(
        $.ajax({ url: `${API_URL}/produtos`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/compras`, method: 'GET' })
    ).done(function(produtosResp, comprasResp) {
        produtosList = produtosResp[0] || [];
        renderCompras(comprasResp[0] || []);
    }).fail(function() {
        $('#page-content').html('<div class="alert alert-danger">Erro ao carregar compras.</div>');
    });
}

function renderCompras(compras) {
    const html = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div><i class="fas fa-shopping-cart"></i> Compras</div>
                <button class="btn btn-primary btn-sm" onclick="showCompraModal()"><i class="fas fa-plus"></i> Nova compra</button>
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    Ao salvar a compra, o sistema dá entrada no estoque, atualiza custo/preço de venda e lança a despesa automaticamente no financeiro.
                </div>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>NF</th>
                                <th>Data</th>
                                <th>Fornecedor</th>
                                <th>Total</th>
                                <th>Condição</th>
                                <th>Forma</th>
                                <th>Pendências</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${compras.map(c => `
                                <tr>
                                    <td>${c.nota_fiscal || '-'}${c.chave_acesso ? '<div class="small text-muted">chave vinculada</div>' : ''}</td>
                                    <td>${formatDate(c.data_compra)}</td>
                                    <td>${c.fornecedor || '-'}</td>
                                    <td>${formatCurrency(c.total)}</td>
                                    <td>${rotuloCondicaoPagamento(c.condicao_pagamento || 'avista')}</td>
                                    <td>${rotuloFormaPagamento(c.forma_pagamento)}</td>
                                    <td>${c.parcelas_pendentes || 0}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="viewCompra(${c.id})"><i class="fas fa-eye"></i></button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteCompra(${c.id})"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="8" class="text-center">Nenhuma compra registrada.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    $('#page-content').html(html);
}

function rotuloCondicaoPagamento(value) {
    const mapa = { avista: 'À vista', prazo: 'A prazo', parcelado: 'Parcelado' };
    return mapa[value] || value || '-';
}

function rotuloFormaPagamento(value) {
    const mapa = {
        dinheiro: 'Dinheiro',
        pix: 'PIX',
        cartao_credito: 'Cartão crédito',
        cartao_debito: 'Cartão débito',
        boleto: 'Boleto',
        transferencia: 'Transferência',
        cheque: 'Cheque'
    };
    return mapa[value] || '-';
}

function formasPagamentoCompra(selected = '') {
    const opcoes = [
        ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['cartao_credito', 'Cartão crédito'], ['cartao_debito', 'Cartão débito'],
        ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['cheque', 'Cheque']
    ];
    return opcoes.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function atualizarVisibilidadePagamentoCompra() {
    const condicao = $('#condicao_pagamento').val();
    if (condicao === 'avista') {
        $('#grupo_vencimento_compra').hide();
        $('#grupo_parcelas_compra').hide();
        $('#data_vencimento').val($('#data_compra').val());
        $('#parcelas').val(1);
    } else if (condicao === 'prazo') {
        $('#grupo_vencimento_compra').show();
        $('#grupo_parcelas_compra').hide();
        $('#parcelas').val(1);
    } else {
        $('#grupo_vencimento_compra').show();
        $('#grupo_parcelas_compra').show();
        if (parseInt($('#parcelas').val(), 10) < 2) $('#parcelas').val(2);
    }
}

function formatNumberInput(value, decimals = 2) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toFixed(decimals) : Number(0).toFixed(decimals);
}

function normalizeItemCompra(item = {}) {
    const custo = Number(item.preco_unitario || item.preco_compra || 0);
    const quantidade = Number(item.quantidade || 1);
    const margem = Number(item.margem_lucro ?? item.lucro_percentual ?? 30);
    const precoVenda = Number(item.preco_venda_sugerido || item.preco_venda || (custo * (1 + margem / 100)) || 0);
    return {
        produto_id: item.produto_id ? Number(item.produto_id) : '',
        produto_nome: item.produto_nome || item.nome || item.descricao_produto || '',
        codigo_barras: item.codigo_barras || item.codigo || '',
        unidade: item.unidade || 'UN',
        ncm: item.ncm || '',
        quantidade,
        preco_unitario: Number(custo.toFixed(2)),
        margem_lucro: Number(margem.toFixed(2)),
        preco_venda_sugerido: Number(precoVenda.toFixed(2)),
        subtotal: Number((quantidade * custo).toFixed(2))
    };
}

function recalcularLinhaCompra(index, origem = 'custo') {
    const item = itensCompraAtual[index];
    if (!item) return;
    item.quantidade = Number(item.quantidade || 0);
    item.preco_unitario = Number(item.preco_unitario || 0);
    item.margem_lucro = Number(item.margem_lucro || 0);
    item.preco_venda_sugerido = Number(item.preco_venda_sugerido || 0);

    if (origem === 'margem' || origem === 'custo') {
        item.preco_venda_sugerido = Number((item.preco_unitario * (1 + (item.margem_lucro / 100))).toFixed(2));
    } else if (origem === 'venda') {
        item.margem_lucro = item.preco_unitario > 0
            ? Number((((item.preco_venda_sugerido - item.preco_unitario) / item.preco_unitario) * 100).toFixed(2))
            : 0;
    }

    item.subtotal = Number((item.quantidade * item.preco_unitario).toFixed(2));
}

function renderItensCompraTabela() {
    const tbody = $('#itensCompraBody');
    const total = itensCompraAtual.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const optionsProdutos = '<option value="">Selecione</option>' + produtosList.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    tbody.html(itensCompraAtual.map((item, index) => `
        <tr>
            <td style="min-width:220px;">
                <select class="form-control form-control-sm mb-1" onchange="alterarProdutoItemCompra(${index}, this.value)">
                    ${optionsProdutos.replace(`value="${item.produto_id}"`, `value="${item.produto_id}" selected`)}
                </select>
                <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.produto_nome || '')}" oninput="alterarCampoItemCompra(${index}, 'produto_nome', this.value)">
            </td>
            <td style="min-width:120px;"><input type="text" class="form-control form-control-sm" value="${escapeHtml(item.codigo_barras || '')}" oninput="alterarCampoItemCompra(${index}, 'codigo_barras', this.value)"></td>
            <td style="min-width:90px;"><input type="number" step="0.01" class="form-control form-control-sm" value="${formatNumberInput(item.quantidade)}" oninput="alterarNumeroItemCompra(${index}, 'quantidade', this.value, 'custo')"></td>
            <td style="min-width:110px;"><input type="number" step="0.01" class="form-control form-control-sm" value="${formatNumberInput(item.preco_unitario)}" oninput="alterarNumeroItemCompra(${index}, 'preco_unitario', this.value, 'custo')"></td>
            <td style="min-width:95px;"><input type="number" step="0.01" class="form-control form-control-sm" value="${formatNumberInput(item.margem_lucro)}" oninput="alterarNumeroItemCompra(${index}, 'margem_lucro', this.value, 'margem')"></td>
            <td style="min-width:110px;"><input type="number" step="0.01" class="form-control form-control-sm" value="${formatNumberInput(item.preco_venda_sugerido)}" oninput="alterarNumeroItemCompra(${index}, 'preco_venda_sugerido', this.value, 'venda')"></td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="removerItemCompra(${index})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="text-center">Nenhum item adicionado.</td></tr>');
    $('#totalCompra').text(formatCurrency(total));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function alterarCampoItemCompra(index, campo, valor) {
    if (!itensCompraAtual[index]) return;
    itensCompraAtual[index][campo] = valor;
}

function alterarNumeroItemCompra(index, campo, valor, origem) {
    if (!itensCompraAtual[index]) return;
    itensCompraAtual[index][campo] = Number(valor || 0);
    recalcularLinhaCompra(index, origem);
    renderItensCompraTabela();
}

function alterarProdutoItemCompra(index, produtoId) {
    const produto = produtosList.find(p => String(p.id) === String(produtoId));
    if (!itensCompraAtual[index]) return;
    itensCompraAtual[index].produto_id = produtoId ? Number(produtoId) : '';
    if (produto) {
        itensCompraAtual[index].produto_nome = produto.nome;
        itensCompraAtual[index].codigo_barras = produto.codigo_barras || produto.codigo || '';
        itensCompraAtual[index].unidade = produto.unidade || 'UN';
        itensCompraAtual[index].ncm = produto.ncm || '';
        if (!Number(itensCompraAtual[index].preco_unitario)) {
            itensCompraAtual[index].preco_unitario = Number(produto.preco_compra || 0);
        }
        if (!Number(itensCompraAtual[index].preco_venda_sugerido)) {
            itensCompraAtual[index].preco_venda_sugerido = Number(produto.preco_venda || 0);
        }
        if (!Number(itensCompraAtual[index].margem_lucro)) {
            itensCompraAtual[index].margem_lucro = Number(produto.lucro_percentual || 30);
        }
        recalcularLinhaCompra(index, 'custo');
        renderItensCompraTabela();
    }
}

function adicionarItemCompra() {
    const produtoId = $('#produto_id_item').val();
    const descricaoLivre = ($('#codigo_barras_item').val() || '').trim();
    const quantidade = parseFloat($('#quantidade_item').val());
    const preco = parseFloat($('#preco_item').val());
    const margem = parseFloat($('#margem_padrao_item').val()) || 30;

    if ((!produtoId && !descricaoLivre) || !quantidade || !preco) {
        showNotification('Informe produto ou descrição, quantidade e preço.', 'warning');
        return;
    }

    const produto = produtosList.find(p => String(p.id) === String(produtoId));
    const item = normalizeItemCompra({
        produto_id: produto ? produto.id : '',
        produto_nome: produto ? produto.nome : descricaoLivre,
        codigo_barras: produto ? (produto.codigo_barras || produto.codigo || '') : '',
        quantidade,
        preco_unitario: preco,
        margem_lucro: margem,
        preco_venda: preco * (1 + margem / 100),
        unidade: produto ? (produto.unidade || 'UN') : 'UN',
        ncm: produto ? (produto.ncm || '') : ''
    });

    itensCompraAtual.push(item);
    limparFormularioItemCompra();
    renderItensCompraTabela();
}

function limparFormularioItemCompra() {
    $('#codigo_barras_item').val('');
    $('#produto_id_item').val('');
    $('#quantidade_item').val('1');
    $('#preco_item').val('');
    $('#margem_padrao_item').val('30');
    $('#codigo_barras_item').focus();
}

function removerItemCompra(index) {
    itensCompraAtual.splice(index, 1);
    renderItensCompraTabela();
}

function parseChaveAcessoInfo(chave) {
    const digits = String(chave || '').replace(/\D/g, '');
    if (digits.length !== 44) return null;
    return {
        chave: digits,
        numeroNota: String(parseInt(digits.substr(25, 9), 10)),
        serie: String(parseInt(digits.substr(22, 3), 10)),
        cnpjEmitente: digits.substr(6, 14)
    };
}

function validarChaveAcessoCompra() {
    const info = parseChaveAcessoInfo($('#chave_acesso').val());
    if (!info) {
        showNotification('A chave de acesso precisa ter 44 dígitos.', 'warning');
        return;
    }
    $('#chave_acesso').val(info.chave);
    if (!$('#nota_fiscal').val()) {
        $('#nota_fiscal').val(info.numeroNota);
    }
    showNotification(`Chave validada. NF ${info.numeroNota}, série ${info.serie}.`, 'success');
}

function importarXmlCompra() {
    const input = $('#xml_compra')[0];
    if (!input || !input.files || !input.files.length) {
        showNotification('Selecione um arquivo XML da NF-e.', 'warning');
        return;
    }
    const formData = new FormData();
    formData.append('xml', input.files[0]);

    $.ajax({
        url: `${API_URL}/compras/importar-xml`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
    }).done(function(resp) {
        compraImportadaXml = resp;
        preencherCompraImportada(resp);
        showNotification('XML importado. Revise os dados antes de salvar.', 'success');
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao importar XML.', 'danger');
    });
}

function preencherCompraImportada(resp) {
    if (!resp) return;
    $('#nota_fiscal').val(resp.nota_fiscal || '');
    $('#fornecedor').val(resp.fornecedor || '');
    $('#data_compra').val(resp.data_compra || $('#data_compra').val());
    $('#chave_acesso').val(resp.chave_acesso || $('#chave_acesso').val());
    if (resp.total) {
        $('#resumo_importacao_xml').html(`<div class="alert alert-light border mt-2 mb-0"><strong>XML:</strong> NF ${resp.nota_fiscal || '-'} | Emitente: ${resp.fornecedor || '-'} | Total: ${formatCurrency(resp.total)}</div>`);
    }

    itensCompraAtual = (resp.itens || []).map(item => normalizeItemCompra(item));
    renderItensCompraTabela();
}

function onProdutoInput() {
    const inputValue = $('#codigo_barras_item').val().trim();
    if (!inputValue) {
        $('#produto_id_item').val('');
        return;
    }
    const cleaned = inputValue.replace(/\s+-\s+.*$/, '');
    const produto = produtosList.find(p => [p.codigo, p.codigo_barras].includes(cleaned) || String(p.nome || '').toLowerCase() === inputValue.toLowerCase());
    if (produto) {
        $('#produto_id_item').val(produto.id);
        $('#preco_item').val(produto.preco_compra || '');
        $('#margem_padrao_item').val(produto.lucro_percentual || 30);
    }
}

function showCompraModal() {
    itensCompraAtual = [];
    compraImportadaXml = null;
    const hoje = new Date().toISOString().split('T')[0];
    const modalHtml = `
        <div class="modal fade" id="compraModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nova compra</h5>
                        <div>
                            <button type="button" class="btn btn-sm btn-light me-1" title="Minimizar" onclick="minimizarModal('compraModal')">
                                <i class="fas fa-window-minimize"></i>
                            </button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="card border-0 bg-light mb-3">
                            <div class="card-body pb-2">
                                <div class="row g-2 align-items-end">
                                    <div class="col-md-5 mb-2">
                                        <label class="form-label">Chave de acesso / código de barras da NF-e</label>
                                        <input type="text" class="form-control" id="chave_acesso" placeholder="Use leitor ou cole os 44 dígitos">
                                    </div>
                                    <div class="col-md-2 mb-2">
                                        <button class="btn btn-outline-primary w-100" type="button" onclick="validarChaveAcessoCompra()"><i class="fas fa-barcode"></i> Validar chave</button>
                                    </div>
                                    <div class="col-md-3 mb-2">
                                        <label class="form-label">Importar XML da nota</label>
                                        <input type="file" class="form-control" id="xml_compra" accept=".xml,text/xml,application/xml">
                                    </div>
                                    <div class="col-md-2 mb-2">
                                        <button class="btn btn-outline-success w-100" type="button" onclick="importarXmlCompra()"><i class="fas fa-file-import"></i> Importar XML</button>
                                    </div>
                                </div>
                                <div id="resumo_importacao_xml"></div>
                                <small class="text-muted d-block mt-2">A importação preenche os campos, mas o usuário pode alterar fornecedor, prazos, forma de pagamento, valores e margens antes de salvar.</small>
                            </div>
                        </div>
                        <div class="row g-2">
                            <div class="col-md-3 mb-3">
                                <label class="form-label">Nota fiscal</label>
                                <input type="text" class="form-control" id="nota_fiscal">
                            </div>
                            <div class="col-md-3 mb-3">
                                <label class="form-label">Data da compra *</label>
                                <input type="date" class="form-control" id="data_compra" value="${hoje}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Fornecedor</label>
                                <input type="text" class="form-control" id="fornecedor">
                            </div>
                        </div>
                        <div class="row g-2">
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Condição de pagamento *</label>
                                <select class="form-control" id="condicao_pagamento" onchange="atualizarVisibilidadePagamentoCompra()">
                                    <option value="avista">À vista</option>
                                    <option value="prazo">A prazo</option>
                                    <option value="parcelado">Parcelado</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Forma de pagamento</label>
                                <select class="form-control" id="forma_pagamento"><option value="">Selecione</option>${formasPagamentoCompra()}</select>
                            </div>
                            <div class="col-md-2 mb-3" id="grupo_vencimento_compra" style="display:none;">
                                <label class="form-label">1º vencimento</label>
                                <input type="date" class="form-control" id="data_vencimento" value="${hoje}">
                            </div>
                            <div class="col-md-2 mb-3" id="grupo_parcelas_compra" style="display:none;">
                                <label class="form-label">Parcelas</label>
                                <input type="number" min="2" class="form-control" id="parcelas" value="2">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Observação</label>
                            <textarea class="form-control" id="observacao_compra" rows="2"></textarea>
                        </div>
                        <hr>
                        <h6>Itens da compra</h6>
                        <div class="row g-2 align-items-end">
                            <div class="col-md-4">
                                <label class="form-label">Código de barras / descrição rápida</label>
                                <input type="text" class="form-control" id="codigo_barras_item" placeholder="Leitor, código ou nome" list="produtos-datalist" oninput="onProdutoInput()">
                                <datalist id="produtos-datalist">
                                    ${produtosList.map(p => `<option value="${escapeHtml((p.codigo_barras || p.codigo || '') + ' - ' + p.nome)}"></option>`).join('')}
                                </datalist>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Produto</label>
                                <select class="form-control" id="produto_id_item">
                                    <option value="">Selecione</option>
                                    ${produtosList.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-1">
                                <label class="form-label">Qtd</label>
                                <input type="number" step="0.01" class="form-control" id="quantidade_item" value="1">
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">Preço compra</label>
                                <input type="number" step="0.01" class="form-control" id="preco_item">
                            </div>
                            <div class="col-md-1">
                                <label class="form-label">Margem %</label>
                                <input type="number" step="0.01" class="form-control" id="margem_padrao_item" value="30">
                            </div>
                            <div class="col-md-1">
                                <button class="btn btn-success w-100" onclick="adicionarItemCompra()"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                        <div class="table-responsive mt-3">
                            <table class="table table-bordered align-middle">
                                <thead>
                                    <tr>
                                        <th>Produto / descrição</th>
                                        <th>Cód. barras</th>
                                        <th>Qtd</th>
                                        <th>Preço compra</th>
                                        <th>Margem %</th>
                                        <th>Venda sugerida</th>
                                        <th>Subtotal</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="itensCompraBody"></tbody>
                                <tfoot><tr><th colspan="6" class="text-end">Total</th><th id="totalCompra">${formatCurrency(0)}</th><th></th></tr></tfoot>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="saveCompra()">Salvar compra</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#modal-container').html(modalHtml);
    $('#compraModal').modal('show');
    renderItensCompraTabela();
    atualizarVisibilidadePagamentoCompra();
    setTimeout(() => $('#chave_acesso').focus(), 300);
}

function saveCompra() {
    if (!itensCompraAtual.length) {
        showNotification('Adicione ao menos um item.', 'warning');
        return;
    }

    const total = itensCompraAtual.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const data = {
        nota_fiscal: $('#nota_fiscal').val(),
        chave_acesso: $('#chave_acesso').val(),
        data_compra: $('#data_compra').val(),
        fornecedor: $('#fornecedor').val(),
        total,
        itens: itensCompraAtual.map(item => ({
            produto_id: item.produto_id || null,
            produto_nome: item.produto_nome,
            codigo_barras: item.codigo_barras,
            unidade: item.unidade,
            ncm: item.ncm,
            quantidade: Number(item.quantidade || 0),
            preco_unitario: Number(item.preco_unitario || 0),
            margem_lucro: Number(item.margem_lucro || 0),
            preco_venda_sugerido: Number(item.preco_venda_sugerido || 0),
            subtotal: Number(item.subtotal || 0)
        })),
        condicao_pagamento: $('#condicao_pagamento').val(),
        forma_pagamento: $('#forma_pagamento').val(),
        data_vencimento: $('#data_vencimento').val(),
        parcelas: parseInt($('#parcelas').val(), 10) || 1,
        observacao: $('#observacao_compra').val()
    };

    $.ajax({
        url: `${API_URL}/compras`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    }).done(function() {
        $('#compraModal').modal('hide');
        showNotification('Compra registrada com sucesso!', 'success');
        loadCompras();
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao registrar compra.', 'danger');
    });
}

function viewCompra(id) {
    $.ajax({ url: `${API_URL}/compras/${id}`, method: 'GET' }).done(function(compra) {
        const financeiroHtml = (compra.financeiro || []).map(f => `
            <tr>
                <td>${f.numero_parcela ? `${f.numero_parcela}/${f.total_parcelas}` : '-'}</td>
                <td>${formatDate(f.vencimento || f.data_movimento)}</td>
                <td>${f.status}</td>
                <td>${formatCurrency(f.valor)}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-center">Sem lançamentos financeiros.</td></tr>';
        const itensHtml = (compra.itens || []).map(item => `
            <tr>
                <td>${escapeHtml(item.produto_nome || item.descricao_produto || '-')}</td>
                <td>${item.quantidade}</td>
                <td>${formatCurrency(item.preco_unitario)}</td>
                <td>${item.margem_lucro || 30}%</td>
                <td>${formatCurrency(item.preco_venda_sugerido || 0)}</td>
                <td>${formatCurrency(item.subtotal)}</td>
            </tr>
        `).join('');
        const modalHtml = `
            <div class="modal fade" id="viewCompraModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Compra NF ${compra.nota_fiscal || compra.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Fornecedor:</strong> ${escapeHtml(compra.fornecedor || '-')}</p>
                            <p><strong>Data:</strong> ${formatDate(compra.data_compra)} | <strong>Condição:</strong> ${rotuloCondicaoPagamento(compra.condicao_pagamento || 'avista')} | <strong>Forma:</strong> ${rotuloFormaPagamento(compra.forma_pagamento)}</p>
                            <p><strong>Chave:</strong> ${escapeHtml(compra.chave_acesso || '-')}</p>
                            <p><strong>Total:</strong> ${formatCurrency(compra.total)}</p>
                            <h6>Itens</h6>
                            <table class="table table-bordered"><thead><tr><th>Produto</th><th>Qtd</th><th>Preço compra</th><th>Margem</th><th>Venda sugerida</th><th>Subtotal</th></tr></thead><tbody>${itensHtml}</tbody></table>
                            <h6>Lançamentos financeiros gerados</h6>
                            <table class="table table-bordered"><thead><tr><th>Parcela</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead><tbody>${financeiroHtml}</tbody></table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('#modal-container').html(modalHtml);
        $('#viewCompraModal').modal('show');
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao carregar compra.', 'danger');
    });
}

function deleteCompra(id) {
    if (!confirm('Deseja excluir esta compra? O estoque e o financeiro serão ajustados.')) return;
    $.ajax({ url: `${API_URL}/compras/${id}`, method: 'DELETE' }).done(function() {
        showNotification('Compra excluída com sucesso!', 'success');
        loadCompras();
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao excluir compra.', 'danger');
    });
}
