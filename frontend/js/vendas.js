// Global variables
let produtosVenda = [];
let clientesVenda = [];

// Load vendas page
function loadVendas() {
    // Load products and clients
    $.ajax({
        url: `${API_URL}/produtos`,
        method: 'GET',
        success: function(produtos) {
            produtosVenda = produtos;
            
            $.ajax({
                url: `${API_URL}/clientes`,
                method: 'GET',
                success: function(clientes) {
                    clientesVenda = clientes;
                    
                    $.ajax({
                        url: `${API_URL}/vendas`,
                        method: 'GET',
                        success: function(vendas) {
                            renderVendas(vendas);
                        },
                        error: function() {
                            $('#page-content').html('<div class="alert alert-danger">Erro ao carregar vendas!</div>');
                        }
                    });
                }
            });
        }
    });
}

// Render vendas
function renderVendas(vendas) {
    const html = `
        <div class="card">
            <div class="card-header">
                <div class="row">
                    <div class="col-md-6">
                        <i class="fas fa-cash-register"></i> Lista de Vendas
                    </div>
                    <div class="col-md-6 text-end">
                        <button class="btn btn-primary btn-sm" onclick="showVendaModal()">
                            <i class="fas fa-plus"></i> Nova Venda
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Data</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Desconto</th>
                                <th>Forma Pagamento</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vendas.map(v => `
                                <tr>
                                    <td>${v.codigo}</td>
                                    <td>${formatDate(v.data_venda)}</td>
                                    <td>${v.cliente_nome || 'Consumidor Final'}</td>
                                    <td>${formatCurrency(v.total)}</td>
                                    <td>${formatCurrency(v.desconto || 0)}</td>
                                    <td>${v.forma_pagamento || '-'}</td>
                                    <td>
                                        <span class="badge bg-${v.status === 'concluida' ? 'success' : 'danger'}">
                                            ${v.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="viewVenda(${v.id})">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        ${v.status === 'concluida' ? `
                                            <button class="btn btn-sm btn-warning" onclick="cancelarVenda(${v.id})">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${vendas.length === 0 ? '<tr><td colspan="8" class="text-center">Nenhuma venda registrada</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    $('#page-content').html(html);
}

// Show venda modal
function showVendaModal(venda = null) {
    const isEdit = venda !== null;
    const title = isEdit ? 'Editar Venda' : 'Nova Venda';
    
    const modalHtml = `
        <div class="modal fade" id="vendaModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="vendaForm">
                            <input type="hidden" id="vendaId" value="${isEdit ? venda.id : ''}">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="cliente_id" class="form-label">Cliente</label>
                                    <select class="form-control" id="cliente_id">
                                        <option value="">Consumidor Final</option>
                                        ${clientesVenda.map(c => `
                                            <option value="${c.id}" ${isEdit && venda.cliente_id == c.id ? 'selected' : ''}>
                                                ${c.nome} - ${formatCurrency(c.credito_atual)} crédito
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="forma_pagamento" class="form-label">Forma de Pagamento *</label>
                                    <select class="form-control" id="forma_pagamento" required onchange="togglePrazoFields()">
                                        <option value="">Selecione</option>
                                        <option value="dinheiro" ${isEdit && venda.forma_pagamento === 'dinheiro' ? 'selected' : ''}>Dinheiro</option>
                                        <option value="cartao_credito" ${isEdit && venda.forma_pagamento === 'cartao_credito' ? 'selected' : ''}>Cartão de Crédito</option>
                                        <option value="cartao_debito" ${isEdit && venda.forma_pagamento === 'cartao_debito' ? 'selected' : ''}>Cartão de Débito</option>
                                        <option value="pix" ${isEdit && venda.forma_pagamento === 'pix' ? 'selected' : ''}>PIX</option>
                                        <option value="credito" ${isEdit && venda.forma_pagamento === 'credito' ? 'selected' : ''}>Crédito</option>
                                        <option value="prazo" ${isEdit && venda.forma_pagamento === 'prazo' ? 'selected' : ''}>A Prazo</option>
                                    </select>
                                </div>
                            </div>
                            <div id="camposPrazo" style="display:none;">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="parcelas" class="form-label">Quantidade de Parcelas *</label>
                                        <input type="number" min="1" max="24" class="form-control" id="parcelas" value="${isEdit && venda.parcelas ? venda.parcelas : 1}">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="primeiro_vencimento" class="form-label">Primeiro Vencimento *</label>
                                        <input type="date" class="form-control" id="primeiro_vencimento" value="${isEdit && venda.primeiro_vencimento ? venda.primeiro_vencimento : ''}">
                                    </div>
                                </div>
                            </div>
                            <hr>
                            <h6>Itens da Venda</h6>
                            <div id="itensVenda">
                                ${isEdit && venda.itens ? renderItensVenda(venda.itens) : ''}
                            </div>
                            <button type="button" class="btn btn-success btn-sm mt-2" onclick="addItemVenda()">
                                <i class="fas fa-plus"></i> Adicionar Item
                            </button>
                            <hr>
                            <div class="row">
                                <div class="col-md-6">
                                    <label for="desconto" class="form-label">Desconto</label>
                                    <input type="number" step="0.01" class="form-control" id="desconto" value="${isEdit ? (venda.desconto || 0) : 0}" onchange="calcularTotalVenda()">
                                </div>
                                <div class="col-md-6 text-end">
                                    <h5>Total: <span id="totalVenda">${isEdit ? formatCurrency(venda.total) : 'R$ 0,00'}</span></h5>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="saveVenda()">Finalizar Venda</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#modal-container').html(modalHtml);
    $('#vendaModal').modal('show');
    if (!isEdit) {
        addItemVenda();
    }
    togglePrazoFields();
}

// Exibe/oculta campos de prazo conforme forma de pagamento
function togglePrazoFields() {
    const forma = $('#forma_pagamento').val();
    if (forma === 'prazo') {
        $('#camposPrazo').show();
    } else {
        $('#camposPrazo').hide();
    }
}

// Render itens da venda
function renderItensVenda(itens) {
    let html = '';
    itens.forEach((item, index) => {
        html += `
            <div class="row mb-2 item-venda" data-index="${index}">
                <div class="col-md-5">
                    <select class="form-control produto-select" data-index="${index}" onchange="atualizarPrecoVendaItem(${index})">
                        <option value="">Selecione um produto</option>
                        ${produtosVenda.map(p => `
                            <option value="${p.id}" data-preco="${p.preco_venda}" data-estoque="${p.estoque_atual}" ${item.produto_id == p.id ? 'selected' : ''}>
                                ${p.nome} - ${formatCurrency(p.preco_venda)} (Estoque: ${p.estoque_atual} ${p.unidade})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="col-md-2">
                    <input type="number" step="0.01" class="form-control quantidade" placeholder="Quantidade" data-index="${index}" value="${item.quantidade}" onchange="calcularSubtotalVendaItem(${index})">
                </div>
                <div class="col-md-2">
                    <input type="number" step="0.01" class="form-control preco" placeholder="Preço" data-index="${index}" value="${item.preco_unitario}" onchange="calcularSubtotalVendaItem(${index})">
                </div>
                <div class="col-md-2">
                    <input type="text" class="form-control subtotal" readonly placeholder="Subtotal" data-index="${index}" value="${formatCurrency(item.subtotal)}">
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removerItemVenda(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    return html;
}

// Add item to venda
function addItemVenda() {
    const index = $('.item-venda').length;
    const itemHtml = `
        <div class="row mb-2 item-venda" data-index="${index}">
            <div class="col-md-5">
                <select class="form-control produto-select" data-index="${index}" onchange="atualizarPrecoVendaItem(${index})">
                    <option value="">Selecione um produto</option>
                    ${produtosVenda.map(p => `
                        <option value="${p.id}" data-preco="${p.preco_venda}" data-estoque="${p.estoque_atual}">
                            ${p.nome} - ${formatCurrency(p.preco_venda)} (Estoque: ${p.estoque_atual} ${p.unidade})
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control quantidade" placeholder="Quantidade" data-index="${index}" onchange="calcularSubtotalVendaItem(${index})">
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control preco" placeholder="Preço" data-index="${index}" onchange="calcularSubtotalVendaItem(${index})">
            </div>
            <div class="col-md-2">
                <input type="text" class="form-control subtotal" readonly placeholder="Subtotal" data-index="${index}">
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-sm" onclick="removerItemVenda(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    $('#itensVenda').append(itemHtml);
    calcularTotalVenda();
}

// Update item price
function atualizarPrecoVendaItem(index) {
    const select = $(`.produto-select[data-index="${index}"]`);
    const selectedOption = select.find('option:selected');
    const preco = selectedOption.data('preco') || 0;
    const estoque = selectedOption.data('estoque') || 0;
    
    $(`.preco[data-index="${index}"]`).val(preco);
    
    // Add max attribute for quantity
    $(`.quantidade[data-index="${index}"]`).attr('max', estoque);
    
    calcularSubtotalVendaItem(index);
}

// Calculate item subtotal
function calcularSubtotalVendaItem(index) {
    const quantidade = parseFloat($(`.quantidade[data-index="${index}"]`).val()) || 0;
    const preco = parseFloat($(`.preco[data-index="${index}"]`).val()) || 0;
    const subtotal = quantidade * preco;
    
    $(`.subtotal[data-index="${index}"]`).val(formatCurrency(subtotal));
    calcularTotalVenda();
}

// Calculate total
function calcularTotalVenda() {
    let total = 0;
    $('.subtotal').each(function() {
        const valor = parseFloat($(this).val().replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        total += valor;
    });
    
    const desconto = parseFloat($('#desconto').val()) || 0;
    total -= desconto;
    
    $('#totalVenda').text(formatCurrency(total));
}

// Remove item
function removerItemVenda(index) {
    $(`.item-venda[data-index="${index}"]`).remove();
    calcularTotalVenda();
}

// Save venda
function saveVenda() {
    const itens = [];
    let hasError = false;
    
    $('.item-venda').each(function() {
        const produtoId = $(this).find('.produto-select').val();
        const quantidade = parseFloat($(this).find('.quantidade').val());
        const precoUnitario = parseFloat($(this).find('.preco').val());
        
        if (!produtoId || !quantidade || !precoUnitario) {
            hasError = true;
            return;
        }
        
        // Check stock
        const produto = produtosVenda.find(p => p.id == produtoId);
        if (produto && quantidade > produto.estoque_atual) {
            hasError = true;
            showNotification(`Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque_atual}`, 'danger');
            return;
        }
        
        itens.push({
            produto_id: parseInt(produtoId),
            quantidade: quantidade,
            preco_unitario: precoUnitario,
            subtotal: quantidade * precoUnitario
        });
    });
    
    if (hasError || itens.length === 0) {
        showNotification('Preencha todos os itens corretamente!', 'danger');
        return;
    }
    
    const data = {
        cliente_id: $('#cliente_id').val() ? parseInt($('#cliente_id').val()) : null,
        forma_pagamento: $('#forma_pagamento').val(),
        desconto: parseFloat($('#desconto').val()) || 0,
        total: parseFloat($('#totalVenda').text().replace('R$', '').replace('.', '').replace(',', '.').trim()),
        itens: itens
    };
    // Se for venda a prazo, incluir campos de parcelas
    if (data.forma_pagamento === 'prazo') {
        data.parcelas = parseInt($('#parcelas').val()) || 1;
        data.primeiro_vencimento = $('#primeiro_vencimento').val();
        if (!data.cliente_id) {
            showNotification('Venda a prazo exige cliente selecionado!', 'danger');
            return;
        }
        if (!data.parcelas || !data.primeiro_vencimento) {
            showNotification('Preencha quantidade de parcelas e primeiro vencimento!', 'danger');
            return;
        }
    }
    
    if (!data.forma_pagamento) {
        showNotification('Selecione a forma de pagamento!', 'danger');
        return;
    }

    if (data.forma_pagamento === 'credito' && !data.cliente_id) {
        showNotification('Para venda a crédito, selecione um cliente.', 'danger');
        return;
    }
    
    const url = `${API_URL}/vendas`;
    const method = 'POST';
    
    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            $('#vendaModal').modal('hide');
            showNotification(`Venda registrada com sucesso! Código: ${response.codigo}`);
            loadVendas();
            
            // Print receipt
            if (confirm('Deseja imprimir o cupom fiscal?')) {
                imprimirCupom(response.id);
            }
        },
        error: function(xhr) {
            showNotification('Erro ao registrar venda: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
        }
    });
}

// View venda
function viewVenda(id) {
    $.ajax({
        url: `${API_URL}/vendas/${id}`,
        method: 'GET',
        success: function(venda) {
            const modalHtml = `
                <div class="modal fade" id="viewVendaModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalhes da Venda</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Código:</strong> ${venda.codigo}</p>
                                <p><strong>Data da Venda:</strong> ${formatDate(venda.data_venda)}</p>
                                <p><strong>Cliente:</strong> ${venda.cliente_nome || 'Consumidor Final'}</p>
                                <p><strong>Forma de Pagamento:</strong> ${venda.forma_pagamento || '-'}</p>
                                <p><strong>Desconto:</strong> ${formatCurrency(venda.desconto || 0)}</p>
                                <p><strong>Total:</strong> ${formatCurrency(venda.total)}</p>
                                <p><strong>Status:</strong> ${venda.status}</p>
                                
                                <hr>
                                <h6>Itens da Venda</h6>
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
                                            ${venda.itens.map(item => `
                                                <tr>
                                                    <td>${item.produto_nome}</td>
                                                    <td>${item.quantidade} ${item.unidade}</td>
                                                    <td>${formatCurrency(item.preco_unitario)}</td>
                                                    <td>${formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <hr>
                                <div class="text-end">
                                    <h5>Total: ${formatCurrency(venda.total)}</h5>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                                <button type="button" class="btn btn-primary" onclick="imprimirCupom(${venda.id})">Imprimir Cupom</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#modal-container').html(modalHtml);
            $('#viewVendaModal').modal('show');
        }
    });
}

// Cancel venda
function cancelarVenda(id) {
    if (confirm('Cancelar esta venda? O estoque será restaurado, o saldo financeiro ajustado (estorno) e, se for venda a crédito, o valor será abatido do fiado do cliente.')) {
        $.ajax({
            url: `${API_URL}/vendas/${id}/cancelar`,
            method: 'PUT',
            success: function() {
                showNotification('Venda cancelada com sucesso!');
                loadVendas();
            },
            error: function(xhr) {
                showNotification('Erro ao cancelar venda: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
            }
        });
    }
}

// Print receipt
function imprimirCupom(id) {
    $.ajax({
        url: `${API_URL}/vendas/${id}`,
        method: 'GET',
        success: function(venda) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Cupom Fiscal - ${venda.codigo}</title>
                    <style>
                        body {
                            font-family: monospace;
                            font-size: 12px;
                            width: 80mm;
                            margin: 0 auto;
                            padding: 10px;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 1px dashed #000;
                            margin-bottom: 10px;
                            padding-bottom: 10px;
                        }
                        .empresa {
                            font-size: 14px;
                            font-weight: bold;
                        }
                        .cupom-item {
                            margin: 5px 0;
                        }
                        .total {
                            border-top: 1px dashed #000;
                            margin-top: 10px;
                            padding-top: 10px;
                            text-align: right;
                            font-weight: bold;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            border-top: 1px dashed #000;
                            padding-top: 10px;
                            font-size: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="empresa">MERCADÃO DA ECONOMIA</div>
                        <div>CNPJ: 00.000.000/0001-00</div>
                        <div>${new Date().toLocaleString()}</div>
                        <div>CUPOM FISCAL</div>
                        <div>${venda.codigo}</div>
                    </div>
                    
                    <div class="cliente">
                        Cliente: ${venda.cliente_nome || 'Consumidor Final'}
                    </div>
                    
                    <div class="itens">
                        ${venda.itens.map(item => `
                            <div class="cupom-item">
                                ${item.produto_nome}<br>
                                ${item.quantidade} x ${formatCurrency(item.preco_unitario)} = ${formatCurrency(item.subtotal)}
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="total">
                        Subtotal: ${formatCurrency(venda.total + (venda.desconto || 0))}<br>
                        Desconto: ${formatCurrency(venda.desconto || 0)}<br>
                        <strong>TOTAL: ${formatCurrency(venda.total)}</strong><br>
                        Forma Pagamento: ${venda.forma_pagamento}
                    </div>
                    
                    <div class="footer">
                        Obrigado pela preferência!<br>
                        Volte sempre!
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    });
}
