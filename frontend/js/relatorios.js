// Relatórios de contas a receber e vendas a prazo
function loadRelatorioContasReceber(tipo = 'em-aberto') {
    let url = `${API_URL}/contas-receber/${tipo}`;
    $.ajax({
        url: url,
        method: 'GET',
        success: function(parcelas) {
            renderRelatorioContasReceber(parcelas, tipo);
        },
        error: function() {
            $('#page-content').html('<div class="alert alert-danger">Erro ao carregar relatório de contas a receber!');
        }
    });
}

function renderRelatorioContasReceber(parcelas, tipo) {
    let titulo = 'Contas a Receber';
    if (tipo === 'vencidas') titulo = 'Contas Vencidas';
    let html = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-file-invoice-dollar"></i> ${titulo}</span>
                <div>
                    <button class="btn btn-outline-primary btn-sm me-2" onclick="loadRelatorioContasReceber('em-aberto')">Em Aberto</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="loadRelatorioContasReceber('vencidas')">Vencidas</button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Venda</th>
                                <th>Cliente</th>
                                <th>Parcela</th>
                                <th>Valor</th>
                                <th>Vencimento</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${parcelas.map(p => `
                                <tr>
                                    <td>${p.venda_codigo || '-'}</td>
                                    <td>${p.cliente_nome || '-'}</td>
                                    <td>${p.numero_parcela}/${p.total_parcelas}</td>
                                    <td>${formatCurrency(p.valor_parcela)}</td>
                                    <td>${formatDate(p.data_vencimento)}</td>
                                    <td><span class="badge bg-${p.status === 'aberto' ? 'warning' : 'success'}">${p.status}</span></td>
                                </tr>
                            `).join('')}
                            ${parcelas.length === 0 ? '<tr><td colspan="6" class="text-center">Nenhuma parcela encontrada</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    $('#page-content').html(html);
}

// Histórico de vendas a prazo de um cliente
function loadHistoricoVendasPrazo(clienteId) {
    $.ajax({
        url: `${API_URL}/contas-receber/historico/${clienteId}`,
        method: 'GET',
        success: function(parcelas) {
            renderHistoricoVendasPrazo(parcelas);
        },
        error: function() {
            $('#page-content').html('<div class="alert alert-danger">Erro ao carregar histórico do cliente!');
        }
    });
}

function renderHistoricoVendasPrazo(parcelas) {
    let html = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-history"></i> Histórico de Vendas a Prazo
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Venda</th>
                                <th>Parcela</th>
                                <th>Valor</th>
                                <th>Vencimento</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${parcelas.map(p => `
                                <tr>
                                    <td>${p.venda_codigo || '-'}</td>
                                    <td>${p.numero_parcela}/${p.total_parcelas}</td>
                                    <td>${formatCurrency(p.valor_parcela)}</td>
                                    <td>${formatDate(p.data_vencimento)}</td>
                                    <td><span class="badge bg-${p.status === 'aberto' ? 'warning' : 'success'}">${p.status}</span></td>
                                </tr>
                            `).join('')}
                            ${parcelas.length === 0 ? '<tr><td colspan="5" class="text-center">Nenhuma venda a prazo encontrada</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    $('#page-content').html(html);
}
