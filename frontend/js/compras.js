
// Global variable for current products list
let produtosList = [];

// Load compras page
function loadCompras() {
    // Load products for dropdown
    $.ajax({
        url: `${API_URL}/produtos`,
        method: 'GET',
        success: function(produtos) {
            produtosList = produtos;
            
            $.ajax({
                url: `${API_URL}/compras`,
                method: 'GET',
                success: function(compras) {
                    renderCompras(compras);
                },
                error: function() {
                    $('#page-content').html('<div class="alert alert-danger">Erro ao carregar compras!</div>');
                }
            });
        }
    });
}

// Render compras
function renderCompras(compras) {
    const html = `
        <div class="card">
            <div class="card-header">
                <div class="row">
                    <div class="col-md-6">
                        <i class="fas fa-shopping-cart"></i> Lista de Compras
                    </div>
                    <div class="col-md-6 text-end">
                        <input type="text" class="form-control form-control-sm d-inline-block w-auto me-2" id="buscaCompra" placeholder="Buscar por NF ou fornecedor...">
                        <button class="btn btn-primary btn-sm" onclick="showCompraModal()">
                            <i class="fas fa-plus"></i> Nova Compra
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Nota Fiscal</th>
                                <th>Data</th>
                                <th>Fornecedor</th>
                                <th>Total</th>
                                <th>Itens</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="compras-tbody">
                            ${compras.map(c => `
                                <tr>
                                    <td>${c.nota_fiscal || '-'}</td>
                                    <td>${formatDate(c.data_compra)}</td>
                                    <td>${c.fornecedor || '-'}</td>
                                    <td>${formatCurrency(c.total)}</td>
                                    <td>${c.total_itens}</td>
                                    <td>
                                        <span class="badge bg-${c.status === 'concluida' ? 'success' : 'warning'}">
                                            ${c.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="viewCompra(${c.id})">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteCompra(${c.id})">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${compras.length === 0 ? '<tr><td colspan="7" class="text-center">Nenhuma compra registrada</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    $('#page-content').html(html);
    $('#buscaCompra').on('input', function() {
        const termo = $(this).val().toLowerCase();
        const filtrados = compras.filter(c =>
            (c.nota_fiscal && String(c.nota_fiscal).toLowerCase().includes(termo)) ||
            (c.fornecedor && c.fornecedor.toLowerCase().includes(termo))
        );
        $('#compras-tbody').html(filtrados.map(c => `
            <tr>
                <td>${c.nota_fiscal || '-'}</td>
                <td>${formatDate(c.data_compra)}</td>
                <td>${c.fornecedor || '-'}</td>
                <td>${formatCurrency(c.total)}</td>
                <td>${c.total_itens}</td>
                <td>
                    <span class="badge bg-${c.status === 'concluida' ? 'success' : 'warning'}">
                        ${c.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewCompra(${c.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCompra(${c.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join(''));
    });
    return;
    
    $('#page-content').html(html);
}

// Show compra modal
function showCompraModal(compra = null) {
        // Corrige o saveCompra para usar itensCompraRapida
        window.saveCompra = function() {
            if (!itensCompraRapida || itensCompraRapida.length === 0) {
                showNotification('Preencha todos os itens corretamente!', 'danger');
                return;
            }
            const data = {
                nota_fiscal: $('#nota_fiscal').val(),
                data_compra: $('#data_compra').val(),
                fornecedor: $('#fornecedor').val(),
                total: parseFloat($('#totalCompra').text().replace('R$', '').replace('.', '').replace(',', '.').trim()),
                itens: itensCompraRapida.map(i => ({
                    produto_id: i.produto_id,
                    quantidade: i.quantidade,
                    preco_unitario: i.preco_unitario,
                    subtotal: i.subtotal
                }))
            };
            const url = `${API_URL}/compras`;
            const method = 'POST';
            $.ajax({
                url: url,
                method: method,
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: function() {
                    $('#compraModal').modal('hide');
                    showNotification('Compra registrada com sucesso!');
                    loadCompras();
                },
                error: function(xhr) {
                    showNotification('Erro ao registrar compra: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
                }
            });
        };
    const isEdit = compra !== null;
    const title = isEdit ? 'Editar Compra' : 'Nova Compra';
    
    const modalHtml = `
        <div class="modal fade" id="compraModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="compraForm">
                            <input type="hidden" id="compraId" value="${isEdit ? compra.id : ''}">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="nota_fiscal" class="form-label">Nota Fiscal *</label>
                                    <input type="text" class="form-control" id="nota_fiscal" required value="${isEdit ? (compra.nota_fiscal || '') : ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="data_compra" class="form-label">Data da Compra *</label>
                                    <input type="date" class="form-control" id="data_compra" required value="${isEdit ? compra.data_compra : new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="col-md-12 mb-3">
                                    <label for="fornecedor" class="form-label">Fornecedor</label>
                                    <input type="text" class="form-control" id="fornecedor" autocomplete="off" value="${isEdit ? (compra.fornecedor || '') : ''}">
                                    <div id="fornecedor-suggestions" class="list-group position-absolute w-100" style="z-index: 10;"></div>
                                </div>
                            </div>
                            <hr>
                            <h6>Itens da Compra</h6>
                            <div class="row g-2 align-items-end mb-2" id="entrada-rapida-item">
                                <div class="col-md-5 position-relative">
                                    <input type="text" class="form-control produto-autocomplete" id="produtoBuscaRapida" placeholder="Digite o nome ou bip o código de barras" autocomplete="off">
                                    <div class="autocomplete-produto-suggestions list-group position-absolute w-100" style="z-index: 10;"></div>
                                    <input type="hidden" id="produtoIdRapida">
                                </div>
                                <div class="col-md-2">
                                    <input type="number" step="0.01" class="form-control" id="quantidadeRapida" placeholder="Qtd">
                                </div>
                                <div class="col-md-2">
                                    <input type="number" step="0.01" class="form-control" id="precoRapida" placeholder="Valor">
                                </div>
                                <div class="col-md-2">
                                    <button type="button" class="btn btn-success w-100" id="btnAdicionarItemRapido"><i class="fas fa-plus"></i> Adicionar</button>
                                </div>
                            </div>
                            <div id="itensCompra"></div>
                            <hr>
                            <div class="row">
                                <div class="col-md-12 text-end">
                                    <h5>Total: <span id="totalCompra">${isEdit ? formatCurrency(compra.total) : 'R$ 0,00'}</span></h5>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="saveCompra()">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modalHtml);
    $('#compraModal').modal('show');

    // Autocomplete fornecedor
    $('#fornecedor').on('input', function() {
        const termo = $(this).val().trim();
        const $suggestions = $('#fornecedor-suggestions');
        $suggestions.empty();
        if (termo.length < 2) {
            $suggestions.hide();
            return;
        }
        fetch('/api/fornecedores?busca=' + encodeURIComponent(termo), {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        })
        .then(res => res.json())
        .then(lista => {
            if (Array.isArray(lista) && lista.length > 0) {
                lista.slice(0, 8).forEach(f => {
                    $suggestions.append(`<button type="button" class="list-group-item list-group-item-action">${f.nome}</button>`);
                });
                $suggestions.show();
            } else {
                $suggestions.hide();
            }
        });
    });
    // Seleciona fornecedor ao clicar
    $(document).on('click', '#fornecedor-suggestions .list-group-item', function() {
        $('#fornecedor').val($(this).text());
        $('#fornecedor-suggestions').hide();
    });
    // Esconde sugestões ao perder foco
    $('#fornecedor').on('blur', function() {
        setTimeout(() => $('#fornecedor-suggestions').hide(), 200);
    });

    // Entrada rápida de item
    let itensCompraRapida = [];
    function renderItensCompraRapida() {
        let html = '';
        itensCompraRapida.forEach((item, index) => {
            html += `<div class="row mb-2 item-compra" data-index="${index}">
                <div class="col-md-5">${item.nome} <small class="text-muted">(${item.codigo})</small></div>
                <div class="col-md-2">${item.quantidade}</div>
                <div class="col-md-2">${formatCurrency(item.preco_unitario)}</div>
                <div class="col-md-2">${formatCurrency(item.subtotal)}</div>
                <div class="col-md-1"><button type="button" class="btn btn-danger btn-sm" onclick="removerItemCompraRapida(${index})"><i class="fas fa-trash"></i></button></div>
            </div>`;
        });
        $('#itensCompra').html(html);
        calcularTotalCompraRapida();
    }
    function calcularTotalCompraRapida() {
        let total = 0;
        itensCompraRapida.forEach(item => total += item.subtotal);
        $('#totalCompra').text(formatCurrency(total));
    }
    window.removerItemCompraRapida = function(index) {
        itensCompraRapida.splice(index, 1);
        renderItensCompraRapida();
    };
    // Autocomplete produto
    $('#produtoBuscaRapida').on('input', function() {
        const termo = $(this).val().trim();
        const $suggestions = $(this).siblings('.autocomplete-produto-suggestions');
        $suggestions.empty();
        if (termo.length < 2) {
            $suggestions.hide();
            return;
        }
        fetch(`/api/produtos?busca=${encodeURIComponent(termo)}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        })
        .then(res => res.json())
        .then(lista => {
            if (Array.isArray(lista) && lista.length > 0) {
                lista.slice(0, 8).forEach(p => {
                    $suggestions.append(`<button type="button" class="list-group-item list-group-item-action" data-id="${p.id}" data-nome="${p.nome}" data-codigo="${p.codigo}" data-preco="${p.preco_compra || 0}">${p.nome} - ${p.codigo || ''}</button>`);
                });
                $suggestions.show();
            } else {
                $suggestions.hide();
            }
        });
    });
    // Seleciona produto ao clicar
    $(document).on('click', '.autocomplete-produto-suggestions .list-group-item', function() {
        const $btn = $(this);
        $('#produtoBuscaRapida').val($btn.data('nome'));
        $('#produtoIdRapida').val($btn.data('id'));
        $('#produtoBuscaRapida').data('codigo', $btn.data('codigo'));
        $('#precoRapida').val($btn.data('preco'));
        $btn.parent().hide();
        setTimeout(() => $('#quantidadeRapida').focus(), 100);
    });
    // Esconde sugestões ao perder foco
    $('#produtoBuscaRapida').on('blur', function() {
        setTimeout(() => $(this).siblings('.autocomplete-produto-suggestions').hide(), 200);
    });
    // Adiciona item ao pressionar Enter em qualquer campo
    $('#entrada-rapida-item input').on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $('#btnAdicionarItemRapido').click();
        }
    });
    // Botão adicionar item
    $('#btnAdicionarItemRapido').on('click', function() {
        const produtoId = $('#produtoIdRapida').val();
        const nome = $('#produtoBuscaRapida').val();
        const codigo = $('#produtoBuscaRapida').data('codigo') || '';
        const quantidade = parseFloat($('#quantidadeRapida').val());
        const preco = parseFloat($('#precoRapida').val());
        if (!produtoId || !nome || !quantidade || !preco) {
            showNotification('Preencha produto, quantidade e valor!', 'danger');
            return;
        }
        itensCompraRapida.push({ produto_id: parseInt(produtoId), nome, codigo, quantidade, preco_unitario: preco, subtotal: quantidade * preco });
        renderItensCompraRapida();
        // Limpa campos para próximo item
        $('#produtoBuscaRapida').val('').data('codigo', '');
        $('#produtoIdRapida').val('');
        $('#quantidadeRapida').val('');
        $('#precoRapida').val('');
        $('#produtoBuscaRapida').focus();
    });
    // Inicializa lista se edição
    if (isEdit && compra.itens) {
        itensCompraRapida = compra.itens.map(i => ({
            produto_id: i.produto_id,
            nome: i.nome || '',
            codigo: i.codigo || '',
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
            subtotal: i.subtotal
        }));
        renderItensCompraRapida();
    }
}

// Render itens da compra
function renderItensCompra(itens) {
    let html = '';
    itens.forEach((item, index) => {
            html += `
                <div class="row mb-2 item-compra" data-index="${index}">
                    <div class="col-md-5 position-relative">
                        <input type="text" class="form-control produto-autocomplete" data-index="${index}" placeholder="Digite o nome ou bip o código de barras" value="${item.nome || ''}" autocomplete="off">
                        <div class="autocomplete-produto-suggestions list-group position-absolute w-100" style="z-index: 10;"></div>
                        <input type="hidden" class="produto-id" data-index="${index}" value="${item.produto_id || ''}">
                    </div>
                <div class="col-md-2">
                    <input type="number" step="0.01" class="form-control quantidade" placeholder="Quantidade" data-index="${index}" value="${item.quantidade}" onchange="calcularSubtotalItem(${index})">
                </div>
                <div class="col-md-2">
                    <input type="number" step="0.01" class="form-control preco" placeholder="Preço" data-index="${index}" value="${item.preco_unitario}" onchange="calcularSubtotalItem(${index})">
                </div>
                <div class="col-md-2">
                    <input type="text" class="form-control subtotal" readonly placeholder="Subtotal" data-index="${index}" value="${formatCurrency(item.subtotal)}">
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removerItemCompra(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    return html;
}

// Add item to compra
function addItemCompra() {
    const index = $('.item-compra').length;
        const itemHtml = `
            <div class="row mb-2 item-compra" data-index="${index}">
                <div class="col-md-5 position-relative">
                    <input type="text" class="form-control produto-autocomplete" data-index="${index}" placeholder="Digite o nome ou bip o código de barras" autocomplete="off">
                    <div class="autocomplete-produto-suggestions list-group position-absolute w-100" style="z-index: 10;"></div>
                    <input type="hidden" class="produto-id" data-index="${index}">
                </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control quantidade" placeholder="Quantidade" data-index="${index}" onchange="calcularSubtotalItem(${index})">
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control preco" placeholder="Preço" data-index="${index}" onchange="calcularSubtotalItem(${index})">
            </div>
            <div class="col-md-2">
                <input type="text" class="form-control subtotal" readonly placeholder="Subtotal" data-index="${index}">
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-sm" onclick="removerItemCompra(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    $('#itensCompra').append(itemHtml);
    calcularTotalCompra();
}

// Update item price
function atualizarPrecoItem(index) {
    const select = $(`.produto-select[data-index="${index}"]`);
    const selectedOption = select.find('option:selected');
    const preco = selectedOption.data('preco') || 0;
    
    $(`.preco[data-index="${index}"]`).val(preco);
    calcularSubtotalItem(index);
}

// Calculate item subtotal
function calcularSubtotalItem(index) {
    const quantidade = parseFloat($(`.quantidade[data-index="${index}"]`).val()) || 0;
    const preco = parseFloat($(`.preco[data-index="${index}"]`).val()) || 0;
    const subtotal = quantidade * preco;
    
    $(`.subtotal[data-index="${index}"]`).val(formatCurrency(subtotal));
    calcularTotalCompra();
}

// Calculate total
function calcularTotalCompra() {
    let total = 0;
    $('.subtotal').each(function() {
        const valor = parseFloat($(this).val().replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        total += valor;
    });
    $('#totalCompra').text(formatCurrency(total));
}

// Remove item
function removerItemCompra(index) {
    $(`.item-compra[data-index="${index}"]`).remove();
    calcularTotalCompra();
}

// Save compra

// View compra
function viewCompra(id) {
    $.ajax({
        url: `${API_URL}/compras/${id}`,
        method: 'GET',
        success: function(compra) {
            const modalHtml = `
                <div class="modal fade" id="viewCompraModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalhes da Compra</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Nota Fiscal:</strong> ${compra.nota_fiscal || '-'}</p>
                                <p><strong>Data da Compra:</strong> ${formatDate(compra.data_compra)}</p>
                                <p><strong>Fornecedor:</strong> ${compra.fornecedor || '-'}</p>
                                <p><strong>Total:</strong> ${formatCurrency(compra.total)}</p>
                                <p><strong>Status:</strong> ${compra.status}</p>
                                
                                <hr>
                                <h6>Itens da Compra</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Produto</th>
                                                <th>Quantidade</th>
                                                <th>Preço Unitário</th>
                                                <th>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${compra.itens.map(item => `
                                                <tr>
                                                    <td>${item.produto_nome}</td>
                                                    <td>${item.quantidade}</td>
                                                    <td>${formatCurrency(item.preco_unitario)}</td>
                                                    <td>${formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#modal-container').html(modalHtml);
            $('#viewCompraModal').modal('show');
        }
    });
}

// Delete compra
function deleteCompra(id) {
    if (confirm('Tem certeza que deseja excluir esta compra? Isso irá ajustar o estoque dos produtos.')) {
        $.ajax({
            url: `${API_URL}/compras/${id}`,
            method: 'DELETE',
            success: function() {
                showNotification('Compra excluída com sucesso!');
                loadCompras();
            },
            error: function(xhr) {
                showNotification('Erro ao excluir compra: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
            }
        });
    }
}