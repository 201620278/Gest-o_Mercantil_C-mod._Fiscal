// Load financeiro page
function loadFinanceiro() {
    const hoje = new Date().toISOString().split('T')[0];
    const mesPassado = new Date();
    mesPassado.setMonth(mesPassado.getMonth() - 1);
    
    $.ajax({
        url: `${API_URL}/financeiro?data_inicio=${mesPassado.toISOString().split('T')[0]}&data_fim=${hoje}`,
        method: 'GET',
        success: function(movimentacoes) {
            $.ajax({
                url: `${API_URL}/financeiro/resumo?data_inicio=${mesPassado.toISOString().split('T')[0]}&data_fim=${hoje}`,
                method: 'GET',
                success: function(resumo) {
                    renderFinanceiro(movimentacoes, resumo);
                }
            });
        },
        error: function() {
            $('#page-content').html('<div class="alert alert-danger">Erro ao carregar financeiro!</div>');
        }
    });
}

// Render financeiro
function renderFinanceiro(movimentacoes, resumo) {
    const html = `
        <div class="row mb-3">
            <div class="col-md-4">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h6 class="card-title">Total Receitas</h6>
                        <h3 class="card-text">${formatCurrency(resumo.total_receitas || 0)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-danger text-white">
                    <div class="card-body">
                        <h6 class="card-title">Total Despesas</h6>
                        <h3 class="card-text">${formatCurrency(resumo.total_despesas || 0)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h6 class="card-title">Saldo</h6>
                        <h3 class="card-text">${formatCurrency(resumo.saldo || 0)}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <div class="row">
                    <div class="col-md-6">
                        <i class="fas fa-chart-line"></i> Movimentações Financeiras
                    </div>
                    <div class="col-md-6 text-end">
                        <button class="btn btn-primary btn-sm" onclick="showMovimentacaoModal()">
                            <i class="fas fa-plus"></i> Nova Movimentação
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Forma Pagamento</th>
                                <th>Valor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movimentacoes.map(m => `
                                <tr>
                                    <td>${formatDate(m.data_movimento)}</td>
                                    <td>
                                        <span class="badge bg-${m.tipo === 'receita' ? 'success' : 'danger'}">
                                            ${m.tipo === 'receita' ? 'Receita' : 'Despesa'}
                                        </span>
                                    </td>
                                    <td>${m.descricao}</td>
                                    <td>${m.categoria || '-'}</td>
                                    <td>${m.forma_pagamento || '-'}</td>
                                    <td class="${m.tipo === 'receita' ? 'text-success' : 'text-danger'}">
                                        ${m.tipo === 'receita' ? '+' : '-'} ${formatCurrency(m.valor)}
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-warning" onclick="editMovimentacao(${m.id})">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteMovimentacao(${m.id})">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${movimentacoes.length === 0 ? '<tr><td colspan="7" class="text-center">Nenhuma movimentação no período</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    $('#page-content').html(html);
}

// Show movimentacao modal
function showMovimentacaoModal(movimentacao = null) {
    const isEdit = movimentacao !== null;
    const title = isEdit ? 'Editar Movimentação' : 'Nova Movimentação';
    
    const modalHtml = `
        <div class="modal fade" id="movimentacaoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="movimentacaoForm">
                            <input type="hidden" id="movimentacaoId" value="${isEdit ? movimentacao.id : ''}">
                            <div class="mb-3">
                                <label for="tipo" class="form-label">Tipo *</label>
                                <select class="form-control" id="tipo" required>
                                    <option value="">Selecione</option>
                                    <option value="receita" ${isEdit && movimentacao.tipo === 'receita' ? 'selected' : ''}>Receita</option>
                                    <option value="despesa" ${isEdit && movimentacao.tipo === 'despesa' ? 'selected' : ''}>Despesa</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="descricao" class="form-label">Descrição *</label>
                                <input type="text" class="form-control" id="descricao" required value="${isEdit ? movimentacao.descricao : ''}">
                            </div>
                            <div class="mb-3">
                                <label for="valor" class="form-label">Valor *</label>
                                <input type="number" step="0.01" class="form-control" id="valor" required value="${isEdit ? movimentacao.valor : 0}">
                            </div>
                            <div class="mb-3">
                                <label for="data_movimento" class="form-label">Data *</label>
                                <input type="date" class="form-control" id="data_movimento" required value="${isEdit ? movimentacao.data_movimento : new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="mb-3">
                                <label for="categoria" class="form-label">Categoria</label>
                                <select class="form-control" id="categoria">
                                    <option value="">Selecione</option>
                                    <option value="vendas" ${isEdit && movimentacao.categoria === 'vendas' ? 'selected' : ''}>Vendas</option>
                                    <option value="compras" ${isEdit && movimentacao.categoria === 'compras' ? 'selected' : ''}>Compras</option>
                                    <option value="salarios" ${isEdit && movimentacao.categoria === 'salarios' ? 'selected' : ''}>Salários</option>
                                    <option value="aluguel" ${isEdit && movimentacao.categoria === 'aluguel' ? 'selected' : ''}>Aluguel</option>
                                    <option value="contas" ${isEdit && movimentacao.categoria === 'contas' ? 'selected' : ''}>Contas</option>
                                    <option value="impostos" ${isEdit && movimentacao.categoria === 'impostos' ? 'selected' : ''}>Impostos</option>
                                    <option value="outros" ${isEdit && movimentacao.categoria === 'outros' ? 'selected' : ''}>Outros</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="forma_pagamento" class="form-label">Forma de Pagamento</label>
                                <select class="form-control" id="forma_pagamento">
                                    <option value="">Selecione</option>
                                    <option value="dinheiro" ${isEdit && movimentacao.forma_pagamento === 'dinheiro' ? 'selected' : ''}>Dinheiro</option>
                                    <option value="cartao_credito" ${isEdit && movimentacao.forma_pagamento === 'cartao_credito' ? 'selected' : ''}>Cartão de Crédito</option>
                                    <option value="cartao_debito" ${isEdit && movimentacao.forma_pagamento === 'cartao_debito' ? 'selected' : ''}>Cartão de Débito</option>
                                    <option value="pix" ${isEdit && movimentacao.forma_pagamento === 'pix' ? 'selected' : ''}>PIX</option>
                                    <option value="boleto" ${isEdit && movimentacao.forma_pagamento === 'boleto' ? 'selected' : ''}>Boleto</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="saveMovimentacao()">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modalHtml);
    $('#movimentacaoModal').modal('show');
}

// Save movimentacao
function saveMovimentacao() {
    const id = $('#movimentacaoId').val();
    const data = {
        tipo: $('#tipo').val(),
        descricao: $('#descricao').val(),
        valor: parseFloat($('#valor').val()),
        data_movimento: $('#data_movimento').val(),
        categoria: $('#categoria').val(),
        forma_pagamento: $('#forma_pagamento').val()
    };
    
    if (!data.tipo || !data.descricao || !data.valor || !data.data_movimento) {
        showNotification('Preencha todos os campos obrigatórios!', 'danger');
        return;
    }
    
    const url = id ? `${API_URL}/financeiro/${id}` : `${API_URL}/financeiro`;
    const method = id ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function() {
            $('#movimentacaoModal').modal('hide');
            showNotification('Movimentação salva com sucesso!');
            loadFinanceiro();
        },
        error: function(xhr) {
            showNotification('Erro ao salvar movimentação: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
        }
    });
}

// Edit movimentacao
function editMovimentacao(id) {
    $.ajax({
        url: `${API_URL}/financeiro`,
        method: 'GET',
        success: function(movimentacoes) {
            const movimentacao = movimentacoes.find(m => m.id === id);
            if (movimentacao) {
                showMovimentacaoModal(movimentacao);
            }
        }
    });
}

// Delete movimentacao
function deleteMovimentacao(id) {
    if (confirm('Tem certeza que deseja excluir esta movimentação?')) {
        $.ajax({
            url: `${API_URL}/financeiro/${id}`,
            method: 'DELETE',
            success: function() {
                showNotification('Movimentação excluída com sucesso!');
                loadFinanceiro();
            },
            error: function(xhr) {
                showNotification('Erro ao excluir movimentação: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
            }
        });
    }
}
