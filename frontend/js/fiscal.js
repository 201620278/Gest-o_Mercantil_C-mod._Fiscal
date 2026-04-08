function loadFiscal() {
    const html = `
        <div class="container-fluid">
            <h2 class="mb-4">Módulo Fiscal</h2>

            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">Configuração Fiscal</div>
                        <div class="card-body">
                            <button class="btn btn-primary" onclick="abrirConfigFiscal()">Configurar Empresa</button>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">Notas Emitidas</div>
                        <div class="card-body">
                            <button class="btn btn-success" onclick="listarNotasFiscais()">Ver NFC-es</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="fiscal-content"></div>
        </div>
    `;

    $('#page-content').html(html);
}

function abrirConfigFiscal() {
    if (typeof loadConfiguracoes === 'function') {
        loadPage('configuracoes');
    } else {
        $('#fiscal-content').html('<div class="alert alert-danger">Módulo de configurações não disponível.</div>');
    }
}

function listarNotasFiscais() {
    $('#fiscal-content').html('<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">Carregando notas fiscais...</div></div>');

    $.ajax({
        url: `${API_URL}/fiscal/notas`,
        method: 'GET',
        success: function(notas) {
            if (!notas || notas.length === 0) {
                $('#fiscal-content').html('<div class="alert alert-warning">Nenhuma NFC-e registrada ainda.</div>');
                return;
            }

            const rows = notas.map(nota => `
                <tr>
                    <td>${escapeHtml(nota.id)}</td>
                    <td>${escapeHtml(nota.venda_id)}</td>
                    <td>${escapeHtml(nota.venda_codigo || '')}</td>
                    <td>${escapeHtml(nota.cliente_nome || '')}</td>
                    <td>${escapeHtml(nota.numero)}</td>
                    <td>${escapeHtml(nota.serie)}</td>
                    <td>${escapeHtml(nota.ambiente)}</td>
                    <td>${escapeHtml(nota.status)}</td>
                    <td>${escapeHtml(nota.data_emissao)}</td>
                </tr>
            `).join('');

            const html = `
                <div class="card mt-3">
                    <div class="card-header">Notas Fiscais Emitidas</div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm table-striped mb-0">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Venda ID</th>
                                        <th>Código Venda</th>
                                        <th>Cliente</th>
                                        <th>Número</th>
                                        <th>Série</th>
                                        <th>Ambiente</th>
                                        <th>Status</th>
                                        <th>Data Emissão</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            $('#fiscal-content').html(html);
        },
        error: function(xhr) {
            $('#fiscal-content').html('<div class="alert alert-danger">Erro ao carregar notas fiscais.</div>');
            console.error(xhr);
        }
    });
}
