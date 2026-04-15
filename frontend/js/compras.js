let produtosList = [];
let fornecedoresList = [];
let itensCompraAtual = [];

function loadCompras() {
    $.when(
        $.ajax({ url: `${API_URL}/produtos`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/compras`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/fornecedores`, method: 'GET' })
    ).done(function(produtosResp, comprasResp, fornecedoresResp) {
        produtosList = produtosResp[0] || [];
        fornecedoresList = fornecedoresResp[0] || [];
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
                                <th>ID</th>
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
                                    <td>${c.id || '-'}</td>
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
    const mapa = { avista: 'À vista', prazo: 'A prazo', parcelado: 'Parcelado', entrada_parcelado: 'Entrada + Parcelamento' };
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
        $('#grupo_entrada_compra').hide();
        $('#data_vencimento').val($('#data_compra').val());
        $('#parcelas').val(1);
        $('#valor_entrada').val(0);
    } else if (condicao === 'prazo') {
        $('#grupo_vencimento_compra').show();
        $('#grupo_parcelas_compra').show();
        $('#grupo_entrada_compra').hide();
        if (parseInt($('#parcelas').val(), 10) < 1) $('#parcelas').val(1);
        $('#valor_entrada').val(0);
    } else if (condicao === 'parcelado') {
        $('#grupo_vencimento_compra').show();
        $('#grupo_parcelas_compra').show();
        $('#grupo_entrada_compra').hide();
        if (parseInt($('#parcelas').val(), 10) < 1) $('#parcelas').val(1);
        $('#valor_entrada').val(0);
    } else if (condicao === 'entrada_parcelado') {
        $('#grupo_vencimento_compra').show();
        $('#grupo_parcelas_compra').show();
        $('#grupo_entrada_compra').show();
        if (parseInt($('#parcelas').val(), 10) < 1) $('#parcelas').val(1);
    }
    calcularParcelasCompra();
}

function calcularParcelasCompra() {
    const total = itensCompraAtual.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const parcelas = parseInt($('#parcelas').val(), 10) || 1;
    const dataVencimento = $('#data_vencimento').val();
    const condicao = $('#condicao_pagamento').val();
    const valorEntrada = Number($('#valor_entrada').val()) || 0;

    if (!dataVencimento || (parcelas <= 1 && condicao !== 'entrada_parcelado')) {
        $('#parcelas_detalhes').html('');
        return;
    }

    let html = '<h6>Parcelas:</h6><ul class="list-group list-group-flush">';
    const dataBase = new Date(dataVencimento);

    if (condicao === 'entrada_parcelado' && valorEntrada > 0) {
        // Entrada
        html += `<li class="list-group-item d-flex justify-content-between">
            <span>Entrada</span>
            <span>${formatCurrency(valorEntrada)} - ${dataBase.toISOString().split('T')[0]}</span>
        </li>`;
        // Parcelas restantes
        const valorRestante = total - valorEntrada;
        const valorParcela = valorRestante / parcelas;
        for (let i = 0; i < parcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            html += `<li class="list-group-item d-flex justify-content-between">
                <span>Parcela ${i + 1}</span>
                <span>${formatCurrency(valorParcela)} - ${dataParcela.toISOString().split('T')[0]}</span>
            </li>`;
        }
    } else {
        // Parcelas normais
        const valorParcela = total / parcelas;
        for (let i = 0; i < parcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            html += `<li class="list-group-item d-flex justify-content-between">
                <span>Parcela ${i + 1}</span>
                <span>${formatCurrency(valorParcela)} - ${dataParcela.toISOString().split('T')[0]}</span>
            </li>`;
        }
    }
    html += '</ul>';
    $('#parcelas_detalhes').html(html);
}

function formatNumberInput(value, decimals = 2) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toFixed(decimals) : Number(0).toFixed(decimals);
}

function normalizeItemCompra(item = {}) {
    const custo = Number(item.preco_unitario || item.preco_compra || 0);
    const quantidade = Number(item.quantidade || 1);
    const margem = Number(item.margem_lucro ?? item.lucro_percentual ?? 30);
    const ultimoPrecoCompra = Number(item.ultimo_preco_compra || custo);
    const precoVenda = Number(item.preco_venda_sugerido || item.preco_venda || (custo * (1 + margem / 100)) || 0);
    return {
        produto_id: item.produto_id ? Number(item.produto_id) : '',
        produto_nome: item.produto_nome || item.nome || item.descricao_produto || '',
        codigo_barras: item.codigo_barras || item.codigo || '',
        unidade: item.unidade || 'UN',
        ncm: item.ncm || '',
        quantidade,
        preco_unitario: Number(custo.toFixed(2)),
        ultimo_preco_compra: Number(ultimoPrecoCompra.toFixed(2)),
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


function removerItemCompra(index) {
    if (index < 0 || index >= itensCompraAtual.length) return;
    itensCompraAtual.splice(index, 1);
    renderItensCompraTabela();
    calcularParcelasCompra();
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
                <div>${escapeHtml(item.produto_nome || '')}</div>
            </td>
            <td style="min-width:120px;">${escapeHtml(item.codigo_barras || '')}</td>
            <td style="min-width:90px;">${formatNumberInput(item.quantidade)}</td>
            <td style="min-width:110px;">${formatCurrency(item.preco_unitario)}</td>
            <td style="min-width:95px;">${formatNumberInput(item.margem_lucro)}%</td>
            <td style="min-width:110px;">${formatCurrency(item.preco_venda_sugerido)}</td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="editarItemCompra(${index})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="removerItemCompra(${index})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="text-center">Nenhum item adicionado.</td></tr>');
    $('#totalCompra').text(formatCurrency(total));
    calcularParcelasCompra();
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
    if (campo === 'produto_nome' && String(valor).trim() === '') {
        itensCompraAtual[index].produto_id = '';
    }
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
        itensCompraAtual[index].ultimo_preco_compra = Number(produto.preco_compra || 0);
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
    const quantidade = Number($('#quantidade_item').val());
    const preco = Number($('#preco_item').val());
    const margemInput = Number($('#margem_padrao_item').val());
    const precoVendaInput = Number($('#preco_venda_item').val());
    const margem = Number.isFinite(margemInput) ? margemInput : 30;

    if ((!produtoId && !descricaoLivre) || !quantidade || !preco) {
        showNotification('Informe produto ou descrição, quantidade e preço.', 'warning');
        return;
    }

    let margemFinal = margem;
    let precoVenda = preco * (1 + margem / 100);

    if (Number.isFinite(precoVendaInput) && precoVendaInput > 0) {
        precoVenda = precoVendaInput;
        margemFinal = preco > 0 ? ((precoVenda - preco) / preco) * 100 : 0;
    }

    const produto = produtosList.find(p => String(p.id) === String(produtoId));
    const item = normalizeItemCompra({
        produto_id: produto ? produto.id : '',
        produto_nome: produto ? produto.nome : descricaoLivre,
        codigo_barras: produto ? (produto.codigo_barras || produto.codigo || '') : '',
        quantidade,
        preco_unitario: preco,
        ultimo_preco_compra: produto ? Number(produto.preco_compra || 0) : preco,
        margem_lucro: margemFinal,
        preco_venda_sugerido: precoVenda,
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
    $('#preco_venda_item').val('');
    $('#codigo_barras_item').focus();
}

function calcularValorVendaItem() {
    const preco = Number($('#preco_item').val()) || 0;
    const margem = Number($('#margem_padrao_item').val()) || 30;
    const valorVenda = preco * (1 + margem / 100);
    $('#preco_venda_item').val(formatNumberInput(valorVenda));
}

function calcularMargemItem() {
    const preco = Number($('#preco_item').val()) || 0;
    const valorVenda = Number($('#preco_venda_item').val()) || 0;
    if (preco > 0) {
        const margem = ((valorVenda - preco) / preco) * 100;
        $('#margem_padrao_item').val(formatNumberInput(margem));
    }
}

function editarItemCompra(index) {
    const item = itensCompraAtual[index];
    if (!item) return;
    // Preencher os campos do formulário
    $('#codigo_barras_item').val(item.produto_nome || item.codigo_barras || '');
    $('#produto_id_item').val(item.produto_id || '');
    $('#quantidade_item').val(formatNumberInput(item.quantidade));
    $('#preco_item').val(formatNumberInput(item.preco_unitario));
    $('#margem_padrao_item').val(formatNumberInput(item.margem_lucro));
    $('#preco_venda_item').val(formatNumberInput(item.preco_venda_sugerido));
    // Recalcular para consistência
    calcularValorVendaItem();
    // Remover o item da lista
    itensCompraAtual.splice(index, 1);
    renderItensCompraTabela();
    $('#codigo_barras_item').focus();
}

function onFornecedorInput() {
    const inputValue = $('#fornecedor').val();
    if (!inputValue) return;
    const fornecedor = fornecedoresList.find(f => String(f.nome || '').toLowerCase() === inputValue.trim().toLowerCase());
    if (fornecedor) {
        $('#fornecedor').val(fornecedor.nome);
    }
}

function onFornecedorKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const inputValue = $('#fornecedor').val().trim();
    if (!inputValue) return;
    const fornecedor = fornecedoresList.find(f => String(f.nome || '').toLowerCase() === inputValue.toLowerCase());
    if (fornecedor) {
        $('#fornecedor').val(fornecedor.nome);
    }
}

function onProdutoInput() {
    const inputValue = $('#codigo_barras_item').val().trim();
    if (!inputValue) {
        $('#produto_id_item').val('');
        return;
    }
    const produto = findProdutoByInput(inputValue);
    if (produto) {
        $('#produto_id_item').val(produto.id);
        $('#preco_item').val(produto.preco_compra || '');
        $('#margem_padrao_item').val(produto.lucro_percentual || 30);
        calcularValorVendaItem();
    } else {
        $('#produto_id_item').val('');
    }
}

function onProdutoKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const inputValue = $('#codigo_barras_item').val().trim();
    if (!inputValue) return;
    const produto = findProdutoByInput(inputValue);
    if (!produto) return;

    $('#produto_id_item').val(produto.id);
    $('#preco_item').val(produto.preco_compra || '');
    $('#margem_padrao_item').val(produto.lucro_percentual || 30);
    calcularValorVendaItem();
    $('#codigo_barras_item').val(`${produto.codigo_barras || produto.codigo || ''} - ${produto.nome}`);
    if (parseFloat($('#quantidade_item').val()) > 0 && parseFloat($('#preco_item').val()) > 0) {
        adicionarItemCompra();
    } else {
        $('#quantidade_item').focus();
    }
}

function findFornecedorByTerm(term) {
    const lower = term.toLowerCase();
    return fornecedoresList.find(f => {
        const nome = String(f.nome || '').toLowerCase();
        const contato = String(f.contato || '').toLowerCase();
        return nome === lower || nome.startsWith(lower) || contato.includes(lower);
    });
}

function findProdutoByInput(input) {
    const cleaned = input.replace(/\s+-\s+.*$/, '').trim();
    const lower = input.toLowerCase().trim();
    return produtosList.find(p => {
        const codigo = String(p.codigo || '').trim();
        const codigoBarras = String(p.codigo_barras || '').trim();
        const nome = String(p.nome || '').toLowerCase().trim();
        return codigo === cleaned || codigoBarras === cleaned || nome === lower;
    });
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
                        <h5 class="modal-title">Lançamento de Nova compra</h5>
                        <div>
                            <button type="button" class="btn btn-sm btn-light me-1" title="Minimizar" onclick="minimizarModal('compraModal')">
                                <i class="fas fa-window-minimize"></i>
                            </button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                                            <div class="row g-2">
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Data da compra *</label>
                                <input type="date" class="form-control" id="data_compra" value="${hoje}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Fornecedor</label>
                                <input type="text" class="form-control" id="fornecedor" list="fornecedores-datalist" autocomplete="off" oninput="onFornecedorInput()" onkeydown="onFornecedorKeyDown(event)">
                                <datalist id="fornecedores-datalist">
                                    ${fornecedoresList.map(f => `<option value="${escapeHtml(f.nome || '')}"></option>`).join('')}
                                </datalist>
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
                                <input type="text" class="form-control" id="codigo_barras_item" placeholder="Leitor, código ou nome" list="produtos-datalist" autocomplete="off" oninput="onProdutoInput()" onkeydown="onProdutoKeyDown(event)">
                                <datalist id="produtos-datalist">
                                    ${produtosList.map(p => `<option value="${escapeHtml((p.codigo_barras || p.codigo || '') + ' - ' + p.nome)}"></option>`).join('')}
                                </datalist>
                            </div>
                            <div class="col-md-2">
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
                            <div class="col-md-1">
                                <label class="form-label">Preço compra</label>
                                <input type="number" step="0.01" class="form-control" id="preco_item" oninput="calcularValorVendaItem()">
                            </div>
                            <div class="col-md-1">
                                <label class="form-label">Margem %</label>
                                <input type="number" step="0.01" class="form-control" id="margem_padrao_item" value="30" oninput="calcularValorVendaItem()">
                            </div>
                            <div class="col-md-1">
                                <label class="form-label">Valor venda</label>
                                <input type="number" step="0.01" class="form-control" id="preco_venda_item" oninput="calcularMargemItem()">
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
                            <div class="row g-2">
                            <div class="col-md-3 mb-3">
                                <label class="form-label">Condição de pagamento *</label>
                                <select class="form-control" id="condicao_pagamento" onchange="atualizarVisibilidadePagamentoCompra()">
                                    <option value="avista">À vista</option>
                                    <option value="prazo">A prazo</option>
                                    <option value="parcelado">Parcelado</option>
                                    <option value="entrada_parcelado">Entrada + Parcelamento</option>
                                </select>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label class="form-label">Forma de pagamento</label>
                                <select class="form-control" id="forma_pagamento"><option value="">Selecione</option>${formasPagamentoCompra()}</select>
                            </div>
                            <div class="col-md-2 mb-3" id="grupo_entrada_compra" style="display:none;">
                                <label class="form-label">Valor entrada</label>
                                <input type="number" step="0.01" class="form-control" id="valor_entrada" value="0" onchange="calcularParcelasCompra()">
                            </div>
                            <div class="col-md-2 mb-3" id="grupo_parcelas_compra" style="display:none;">
                                <label class="form-label">Parcelas após entrada</label>
                                <input type="number" min="1" class="form-control" id="parcelas" value="1" onchange="calcularParcelasCompra()">
                                <small class="text-muted">Informe quantas parcelas serão geradas após a entrada.</small>
                            </div>
                            <div class="col-md-2 mb-3" id="grupo_vencimento_compra" style="display:none;">
                                <label class="form-label">1º vencimento</label>
                                <input type="date" class="form-control" id="data_vencimento" value="${hoje}" onchange="calcularParcelasCompra()">
                            </div>
                        </div>
                        <div id="parcelas_detalhes" class="mb-3"></div>
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
}

function saveCompra() {
    if (!itensCompraAtual.length) {
        showNotification('Adicione ao menos um item.', 'warning');
        return;
    }

    const total = itensCompraAtual.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const condicaoPagamento = $('#condicao_pagamento').val();
    const valorEntrada = Number($('#valor_entrada').val()) || 0;
    const parcelas = parseInt($('#parcelas').val(), 10) || 1;

    if (condicaoPagamento === 'entrada_parcelado' && valorEntrada <= 0) {
        showNotification('Informe o valor da entrada para Entrada + Parcelamento.', 'warning');
        return;
    }

    const data = {
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
        condicao_pagamento: condicaoPagamento,
        forma_pagamento: $('#forma_pagamento').val(),
        data_vencimento: $('#data_vencimento').val(),
        parcelas,
        valor_entrada: valorEntrada,
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
                            <h5 class="modal-title">Compra ${compra.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Fornecedor:</strong> ${escapeHtml(compra.fornecedor || '-')}</p>
                            <p><strong>Data:</strong> ${formatDate(compra.data_compra)} | <strong>Condição:</strong> ${rotuloCondicaoPagamento(compra.condicao_pagamento || 'avista')} | <strong>Forma:</strong> ${rotuloFormaPagamento(compra.forma_pagamento)}</p>
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
