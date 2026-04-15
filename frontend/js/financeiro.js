const FINANCEIRO_FORMAS_PAGAMENTO = [
    { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
    { value: 'pix', label: 'PIX', icon: '📱' },
    { value: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
    { value: 'cartao_debito', label: 'Cartão Débito', icon: '💳' },
    { value: 'boleto', label: 'Boleto', icon: '🧾' },
    { value: 'transferencia', label: 'Transferência', icon: '🏦' },
    { value: 'cheque', label: 'Cheque', icon: '📝' },
    { value: 'crediario', label: 'Crediário', icon: '📒' },
    { value: 'prazo', label: 'A Prazo', icon: '📆' }
];

const FINANCEIRO_STATUS = [
    { value: '', label: 'Todos' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'pago', label: 'Pagos' },
    { value: 'recebido', label: 'Recebidos' }
];

const FINANCEIRO_ORIGENS = [
    { value: '', label: 'Todas' },
    { value: 'manual', label: 'Manual' },
    { value: 'compra', label: 'Compra' },
    { value: 'venda', label: 'Venda' },
    { value: 'cancelamento_venda', label: 'Cancelamento' }
];

function nomeFormaPagamento(forma) {
    const item = FINANCEIRO_FORMAS_PAGAMENTO.find(f => f.value === forma);
    return item ? `${item.icon} ${item.label}` : (forma || '-');
}

function badgeStatus(status) {
    const mapa = {
        pendente: 'warning',
        vencido: 'danger',
        pago: 'success',
        recebido: 'success'
    };
    return `<span class="badge bg-${mapa[status] || 'secondary'}">${status || '-'}</span>`;
}

function buildSelectOptions(items, selected = '') {
    return items.map(item => `<option value="${item.value}" ${selected === item.value ? 'selected' : ''}>${item.label}</option>`).join('');
}

function loadFinanceiro(filtros = {}) {
    const hoje = new Date().toISOString().split('T')[0];
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const dataInicio = filtros.data_inicio || inicioMes.toISOString().split('T')[0];
    const dataFim = filtros.data_fim || hoje;

    const query = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
    if (filtros.tipo) query.append('tipo', filtros.tipo);
    if (filtros.forma_pagamento) query.append('forma_pagamento', filtros.forma_pagamento);
    if (filtros.status) query.append('status', filtros.status);
    if (filtros.origem) query.append('origem', filtros.origem);

    $.when(
        $.ajax({ url: `${API_URL}/financeiro?${query.toString()}`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/financeiro/resumo?${query.toString()}`, method: 'GET' })
    ).done(function(movResp, resumoResp) {
        renderFinanceiro(movResp[0], resumoResp[0], { ...filtros, data_inicio: dataInicio, data_fim: dataFim });
    }).fail(function() {
        $('#page-content').html('<div class="alert alert-danger">Erro ao carregar o financeiro.</div>');
    });
}

function renderFinanceiro(movimentacoes, resumo, filtros) {
    const html = `
        <h3><i class="fas fa-wallet"></i> Financeiro</h3>
        <div class="alert alert-info">
            Compras agora geram <strong>despesas automáticas</strong> e vendas geram <strong>receitas automáticas</strong>.
            Use o botão abaixo apenas para despesas e ajustes avulsos, como aluguel, água, luz e internet.
        </div>

        <div class="card mb-3">
            <div class="card-body">
                <div class="row g-2 align-items-end">
                    <div class="col-md-2">
                        <label class="form-label">Data início</label>
                        <input type="date" class="form-control" id="filtro_data_inicio" value="${filtros.data_inicio}">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Data fim</label>
                        <input type="date" class="form-control" id="filtro_data_fim" value="${filtros.data_fim}">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Tipo</label>
                        <select class="form-control" id="filtro_tipo">
                            <option value="">Todos</option>
                            <option value="receita" ${filtros.tipo === 'receita' ? 'selected' : ''}>Receitas</option>
                            <option value="despesa" ${filtros.tipo === 'despesa' ? 'selected' : ''}>Despesas</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Status</label>
                        <select class="form-control" id="filtro_status">${buildSelectOptions(FINANCEIRO_STATUS, filtros.status || '')}</select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Origem</label>
                        <select class="form-control" id="filtro_origem">${buildSelectOptions(FINANCEIRO_ORIGENS, filtros.origem || '')}</select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Forma pgto.</label>
                        <select class="form-control" id="filtro_forma_pagamento">
                            <option value="">Todas</option>
                            ${FINANCEIRO_FORMAS_PAGAMENTO.map(item => `<option value="${item.value}" ${filtros.forma_pagamento === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    <button class="btn btn-primary" onclick="aplicarFiltrosFinanceiro()"><i class="fas fa-filter"></i> Filtrar</button>
                    <button class="btn btn-secondary" onclick="limparFiltrosFinanceiro()"><i class="fas fa-undo"></i> Limpar</button>
                    <button class="btn btn-danger" onclick="showMovimentacaoModal()"><i class="fas fa-plus"></i> Nova despesa avulsa</button>
                </div>
            </div>
        </div>

        <div class="row mb-3">
            <div class="col-md-3"><div class="card bg-success text-white"><div class="card-body"><small>Recebido no período</small><h4>${formatCurrency(resumo.total_recebido || 0)}</h4></div></div></div>
            <div class="col-md-3"><div class="card bg-danger text-white"><div class="card-body"><small>Pago no período</small><h4>${formatCurrency(resumo.total_pago || 0)}</h4></div></div></div>
            <div class="col-md-3"><div class="card bg-warning text-dark"><div class="card-body"><small>A receber</small><h4>${formatCurrency(resumo.total_a_receber || 0)}</h4></div></div></div>
            <div class="col-md-3"><div class="card bg-secondary text-white"><div class="card-body"><small>A pagar</small><h4>${formatCurrency(resumo.total_a_pagar || 0)}</h4></div></div></div>
        </div>
        <div class="row mb-3">
            <div class="col-md-12"><div class="card bg-info text-white"><div class="card-body"><small>Saldo realizado (recebido - pago)</small><h4>${formatCurrency(resumo.saldo || 0)}</h4></div></div></div>
        </div>

        <div class="card">
            <div class="card-header"><i class="fas fa-list"></i> Lançamentos</div>
            <div class="card-body table-responsive">
                <table class="table table-striped table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Venc./Data</th>
                            <th>Tipo</th>
                            <th>Origem</th>
                            <th>Descrição</th>
                            <th>Documento</th>
                            <th>Pessoa</th>
                            <th>Status</th>
                            <th>Forma</th>
                            <th>Valor</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movimentacoes.map(m => {
                            const hasReference = m.referencia_id && (m.referencia_tipo === 'compra' || m.referencia_tipo === 'venda');
                            const rowAction = hasReference ? `onclick="abrirReferenciaFinanceira(${m.referencia_id}, '${m.referencia_tipo}')" style="cursor:pointer"` : '';
                            return `
                            <tr ${rowAction}>
                                <td>${formatDate(m.vencimento || m.data_movimento)}</td>
                                <td><span class="badge bg-${m.tipo === 'receita' ? 'success' : 'danger'}">${m.tipo}</span></td>
                                <td>${m.origem || '-'}</td>
                                <td>${m.descricao || '-'}</td>
                                <td>${m.documento || '-'}</td>
                                <td>${m.pessoa_nome || '-'}</td>
                                <td>${badgeStatus(m.status_exibicao || m.status)}</td>
                                <td>${nomeFormaPagamento(m.forma_pagamento)}</td>
                                <td class="${m.tipo === 'receita' ? 'text-success' : 'text-danger'}">${formatCurrency(m.valor)}</td>
                                <td class="text-nowrap">
                                    ${(m.status === 'pendente') ? `<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); baixarMovimentacao(${m.id})"><i class="fas fa-check"></i></button>` : ''}
                                    <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); editMovimentacao(${m.id})"><i class="fas fa-edit"></i></button>
                                    ${(m.origem === 'manual' || !m.origem) ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteMovimentacao(${m.id})"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                            `;
                        }).join('') || '<tr><td colspan="10" class="text-center">Nenhum lançamento no período.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    $('#page-content').html(html);
}

function abrirReferenciaFinanceira(referenciaId, referenciaTipo) {
    if (referenciaTipo === 'compra' && typeof viewCompra === 'function') {
        viewCompra(referenciaId);
        return;
    }
    if (referenciaTipo === 'venda' && typeof viewVenda === 'function') {
        viewVenda(referenciaId);
        return;
    }
    showNotification('Não há referência disponível para este lançamento.', 'info');
}

function showMovimentacaoModal(movimentacao = null) {
    const isEdit = !!movimentacao;
    const title = isEdit ? 'Editar movimentação' : 'Nova despesa avulsa';
    const modalHtml = `
        <div class="modal fade" id="movimentacaoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-light border">Receitas normais vêm das vendas. Aqui o foco é cadastrar despesas avulsas e ajustes.</div>
                        <form id="movimentacaoForm">
                            <input type="hidden" id="movimentacaoId" value="${movimentacao?.id || ''}">
                            <div class="mb-3">
                                <label class="form-label">Tipo</label>
                                <select class="form-control" id="tipo">
                                    <option value="despesa" ${(movimentacao?.tipo || 'despesa') === 'despesa' ? 'selected' : ''}>Despesa</option>
                                    <option value="receita" ${movimentacao?.tipo === 'receita' ? 'selected' : ''}>Receita avulsa</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descrição *</label>
                                <input type="text" class="form-control" id="descricao" value="${movimentacao?.descricao || ''}">
                            </div>
                            <div class="row g-2">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Valor *</label>
                                    <input type="number" step="0.01" class="form-control" id="valor" value="${movimentacao?.valor || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Data lançamento *</label>
                                    <input type="date" class="form-control" id="data_movimento" value="${movimentacao?.data_movimento || new Date().toISOString().split('T')[0]}">
                                </div>
                            </div>
                            <div class="row g-2">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Vencimento</label>
                                    <input type="date" class="form-control" id="vencimento" value="${movimentacao?.vencimento || movimentacao?.data_movimento || new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Forma de pagamento</label>
                                    <select class="form-control" id="forma_pagamento">
                                        <option value="">Selecione</option>
                                        ${FINANCEIRO_FORMAS_PAGAMENTO.map(item => `<option value="${item.value}" ${movimentacao?.forma_pagamento === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="row g-2">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Documento</label>
                                    <input type="text" class="form-control" id="documento" value="${movimentacao?.documento || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Favorecido / pessoa</label>
                                    <input type="text" class="form-control" id="pessoa_nome" value="${movimentacao?.pessoa_nome || ''}">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Status</label>
                                <select class="form-control" id="status">
                                    <option value="pendente" ${(movimentacao?.status || 'pendente') === 'pendente' ? 'selected' : ''}>Pendente</option>
                                    <option value="pago" ${movimentacao?.status === 'pago' ? 'selected' : ''}>Pago</option>
                                    <option value="recebido" ${movimentacao?.status === 'recebido' ? 'selected' : ''}>Recebido</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Observação</label>
                                <textarea class="form-control" id="observacao">${movimentacao?.observacao || ''}</textarea>
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

function saveMovimentacao() {
    const id = $('#movimentacaoId').val();
    const data = {
        tipo: $('#tipo').val(),
        descricao: $('#descricao').val(),
        valor: parseFloat($('#valor').val()),
        data_movimento: $('#data_movimento').val(),
        vencimento: $('#vencimento').val(),
        forma_pagamento: $('#forma_pagamento').val(),
        documento: $('#documento').val(),
        pessoa_nome: $('#pessoa_nome').val(),
        status: $('#status').val(),
        observacao: $('#observacao').val(),
        categoria: $('#tipo').val() === 'despesa' ? 'despesa_avulsa' : 'receita_avulsa'
    };

    if (!data.tipo || !data.descricao || !data.valor || !data.data_movimento) {
        showNotification('Preencha os campos obrigatórios.', 'danger');
        return;
    }

    $.ajax({
        url: id ? `${API_URL}/financeiro/${id}` : `${API_URL}/financeiro`,
        method: id ? 'PUT' : 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    }).done(function() {
        $('#movimentacaoModal').modal('hide');
        showNotification('Movimentação salva com sucesso!', 'success');
        loadFinanceiro();
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao salvar movimentação.', 'danger');
    });
}

function editMovimentacao(id) {
    $.ajax({ url: `${API_URL}/financeiro/${id}`, method: 'GET' }).done(function(movimentacao) {
        showMovimentacaoModal(movimentacao);
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao carregar movimentação.', 'danger');
    });
}

function deleteMovimentacao(id) {
    if (!confirm('Deseja excluir esta movimentação?')) return;
    $.ajax({ url: `${API_URL}/financeiro/${id}`, method: 'DELETE' }).done(function() {
        showNotification('Movimentação excluída com sucesso!', 'success');
        loadFinanceiro();
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao excluir movimentação.', 'danger');
    });
}

function baixarMovimentacao(id) {
    $.ajax({ url: `${API_URL}/financeiro/${id}/baixar`, method: 'POST' }).done(function() {
        showNotification('Baixa registrada com sucesso!', 'success');
        loadFinanceiro();
    }).fail(function(xhr) {
        showNotification(xhr.responseJSON?.error || 'Erro ao baixar movimentação.', 'danger');
    });
}

function aplicarFiltrosFinanceiro() {
    loadFinanceiro({
        data_inicio: $('#filtro_data_inicio').val(),
        data_fim: $('#filtro_data_fim').val(),
        tipo: $('#filtro_tipo').val(),
        status: $('#filtro_status').val(),
        origem: $('#filtro_origem').val(),
        forma_pagamento: $('#filtro_forma_pagamento').val()
    });
}

function limparFiltrosFinanceiro() {
    loadFinanceiro({});
}
