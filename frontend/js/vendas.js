let produtosVenda = [];
let clientesVenda = [];

function loadVendas() {
    $.ajax({
        url: `${API_URL}/vendas?_=${Date.now()}`,
        method: 'GET',
        cache: false,
        success: function(vendas) {
            renderVendas(Array.isArray(vendas) ? vendas : []);
        },
        error: function(xhr) {
            console.error('Erro ao carregar vendas:', xhr);
            $('#page-content').html(`
                <div class="alert alert-danger">
                    Erro ao carregar histórico de vendas!
                </div>
            `);
        }
    });

    $.ajax({
        url: `${API_URL}/produtos`,
        method: 'GET',
        success: function(produtos) {
            produtosVenda = Array.isArray(produtos) ? produtos : [];
        },
        error: function(xhr) {
            console.error('Erro ao carregar produtos para vendas:', xhr);
        }
    });

    $.ajax({
        url: `${API_URL}/clientes`,
        method: 'GET',
        success: function(clientes) {
            clientesVenda = Array.isArray(clientes) ? clientes : [];
        },
        error: function(xhr) {
            console.error('Erro ao carregar clientes para vendas:', xhr);
        }
    });
}

function getBadgeFiscal(venda) {
    const status = (venda.nfce_status || venda.status_fiscal || 'nao_emitida').toLowerCase();

    if (status === 'autorizado') {
        return '<span class="badge bg-success">NFC-e autorizada</span>';
    }

    if (status === 'rejeitado') {
        return '<span class="badge bg-danger">NFC-e rejeitada</span>';
    }

    if (status === 'processando' || status === 'pendente') {
        return '<span class="badge bg-warning text-dark">NFC-e em processamento</span>';
    }

    if (status === 'erro_transmissao') {
        return '<span class="badge bg-secondary">Erro transmissão</span>';
    }

    return '<span class="badge bg-light text-dark border">Não emitida</span>';
}

function getBadgeVenda(status) {
    if (status === 'concluida') {
        return '<span class="badge bg-success">Concluída</span>';
    }

    if (status === 'cancelada') {
        return '<span class="badge bg-danger">Cancelada</span>';
    }

    return `<span class="badge bg-secondary">${status || '-'}</span>`;
}

function renderVendas(vendas) {
    const html = `
        <div class="card shadow-sm">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-history"></i> Histórico de Vendas
                </div>
                <button class="btn btn-primary btn-sm" onclick="loadVendas()">
                    <i class="fas fa-rotate-right"></i> Atualizar
                </button>
            </div>

            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Código</th>
                                <th>Data</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Pagamento</th>
                                <th>Status Venda</th>
                                <th>Status Fiscal</th>
                                <th>NFC-e</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${
                                vendas.length > 0
                                    ? vendas.map(v => `
                                        <tr>
                                            <td>${v.id}</td>
                                            <td>${v.codigo || '-'}</td>
                                            <td>${formatDateTime(v.created_at || v.data_venda)}</td>
                                            <td>${v.cliente_nome || 'Consumidor Final'}</td>
                                            <td>${formatCurrency(v.total || 0)}</td>
                                            <td>${v.forma_pagamento || '-'}</td>
                                            <td>${getBadgeVenda(v.status)}</td>
                                            <td>${getBadgeFiscal(v)}</td>
                                            <td>${v.numero_nfce ? `Nº ${v.numero_nfce}` : '-'}</td>
                                            <td>
                                                <button class="btn btn-sm btn-info" onclick="viewVenda(${v.id})" title="Ver venda">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                ${
                                                    v.status === 'concluida'
                                                        ? `
                                                            <button class="btn btn-sm btn-warning" onclick="cancelarVenda(${v.id})" title="Cancelar venda">
                                                                <i class="fas fa-times"></i>
                                                            </button>
                                                        `
                                                        : ''
                                                }
                                            </td>
                                        </tr>
                                    `).join('')
                                    : `
                                        <tr>
                                            <td colspan="10" class="text-center text-muted">
                                                Nenhuma venda registrada.
                                            </td>
                                        </tr>
                                    `
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    $('#page-content').html(html);
}

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
                                <p><strong>Status Fiscal:</strong> ${venda.status_fiscal || 'não emitido'}</p>
                                ${venda.chave_nfce ? `<p><strong>Chave NFC-e:</strong> ${venda.chave_nfce}</p>` : ''}
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
                                                    <td>${item.quantidade} ${item.unidade || ''}</td>
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
            $('#viewVendaModal').modal('show');
        },
        error: function(xhr) {
            console.error('Erro ao buscar venda:', xhr);
            showNotification('Não foi possível carregar os detalhes da venda.', 'danger');
        }
    });
}

function cancelarVenda(id) {
    if (!confirm('Cancelar esta venda?')) {
        return;
    }

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
