let produtosVenda = [];
let clientesVenda = [];
let vendasCache = [];
let vendasMostrandoTodas = false;
const VENDAS_INICIAIS = 10;

function loadVendas() {
    $.ajax({
        url: `${API_URL}/vendas?_=${Date.now()}`,
        method: 'GET',
        cache: false,
        success: function(vendas) {
            vendasCache = Array.isArray(vendas) ? vendas : [];
            vendasMostrandoTodas = false;
            renderVendas(vendasCache);
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

function normalizeDate(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getVendasPorMes(vendas) {
    const meses = {};

    vendas.forEach(venda => {
        const data = new Date(venda.created_at || venda.data_venda);
        if (Number.isNaN(data.getTime())) {
            return;
        }

        const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (!meses[chave]) {
            meses[chave] = {
                ano: data.getFullYear(),
                mes: data.getMonth() + 1,
                vendas: [],
                totalReceita: 0,
                totalDesconto: 0,
            };
        }

        meses[chave].vendas.push(venda);
        meses[chave].totalReceita += Number(venda.total || 0);
        meses[chave].totalDesconto += Number(venda.desconto || 0);
    });

    return Object.values(meses)
        .sort((a, b) => b.ano - a.ano || b.mes - a.mes)
        .map(item => ({
            ...item,
            nome: `${String(item.mes).padStart(2, '0')}/${item.ano}`,
            vendasCount: item.vendas.length,
            totalLiquido: item.totalReceita - item.totalDesconto,
        }));
}

function renderResumoMensal(meses) {
    if (!meses.length) {
        return '<div class="alert alert-light border">Nenhum histórico mensal disponível.</div>';
    }

    const linhas = meses.map(mes => `
        <tr>
            <td>${mes.nome}</td>
            <td>${mes.vendasCount}</td>
            <td>${formatCurrency(mes.totalReceita)}</td>
            <td>${formatCurrency(mes.totalDesconto)}</td>
            <td>${formatCurrency(mes.totalLiquido)}</td>
        </tr>
    `).join('');

    return `
        <div class="card mb-3">
            <div class="card-header">
                <strong>Histórico Mensal</strong>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-sm mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Mês</th>
                                <th>Vendas</th>
                                <th>Total</th>
                                <th>Descontos</th>
                                <th>Receita Líquida</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhas}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function getVendasFiltradas() {
    const termo = $('#vendasBuscaNfce').val()?.trim().toLowerCase();
    const dataDe = $('#vendasBuscaDataDe').val();
    const dataAte = $('#vendasBuscaDataAte').val();

    return vendasCache.filter(venda => {
        if (termo) {
            const nfceNumero = venda.numero_nfce ? String(venda.numero_nfce) : '';
            const chave = venda.chave_nfce ? String(venda.chave_nfce) : '';
            const codigo = venda.codigo ? String(venda.codigo) : '';
            const busca = `${nfceNumero} ${chave} ${codigo}`.toLowerCase();

            if (!busca.includes(termo)) {
                return false;
            }
        }

        if (dataDe || dataAte) {
            const dataVenda = normalizeDate(venda.created_at || venda.data_venda);
            if (!dataVenda) {
                return false;
            }

            if (dataDe) {
                const de = normalizeDate(dataDe);
                if (de && dataVenda < de) {
                    return false;
                }
            }

            if (dataAte) {
                const ate = normalizeDate(dataAte);
                if (ate && dataVenda > ate) {
                    return false;
                }
            }
        }

        return true;
    });
}

function aplicarFiltrosVendas() {
    vendasMostrandoTodas = false;
    renderVendas(getVendasFiltradas());
}

function limparFiltrosVendas() {
    $('#vendasBuscaNfce').val('');
    $('#vendasBuscaDataDe').val('');
    $('#vendasBuscaDataAte').val('');
    vendasMostrandoTodas = false;
    renderVendas(vendasCache);
}

function toggleVendasMais() {
    vendasMostrandoTodas = !vendasMostrandoTodas;
    renderVendas(getVendasFiltradas());
}

function renderVendas(vendas) {
    const termo = $('#vendasBuscaNfce').val()?.trim();
    const dataDe = $('#vendasBuscaDataDe').val();
    const dataAte = $('#vendasBuscaDataAte').val();
    const filtrosAtivos = Boolean(termo || dataDe || dataAte);
    const mostrarTodas = filtrosAtivos || vendasMostrandoTodas;
    const totalVendas = vendas.length;
    const vendasVisiveis = mostrarTodas ? vendas : vendas.slice(0, VENDAS_INICIAIS);
    const ocultas = totalVendas > VENDAS_INICIAIS ? totalVendas - VENDAS_INICIAIS : 0;
    const hasMais = !mostrarTodas && ocultas > 0;

    const resumoTexto = filtrosAtivos
        ? `Exibindo ${totalVendas} resultado(s) da pesquisa.`
        : totalVendas > VENDAS_INICIAIS
            ? `Mostrando ${VENDAS_INICIAIS} vendas mais recentes de ${totalVendas}. Clique em Mostrar mais para acessar as anteriores.`
            : `Mostrando todas as ${totalVendas} vendas.`;

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
                <div class="row g-2 mb-3">
                    <div class="col-md-4">
                        <input id="vendasBuscaNfce" type="text" class="form-control" placeholder="Buscar por NFC-e / Código" value="${termo || ''}" />
                    </div>
                    <div class="col-md-3">
                        <input id="vendasBuscaDataDe" type="date" class="form-control" value="${dataDe || ''}" />
                    </div>
                    <div class="col-md-3">
                        <input id="vendasBuscaDataAte" type="date" class="form-control" value="${dataAte || ''}" />
                    </div>
                    <div class="col-md-2 d-flex gap-2">
                        <button class="btn btn-success w-100" onclick="aplicarFiltrosVendas()">Filtrar</button>
                        <button class="btn btn-secondary w-100" onclick="limparFiltrosVendas()">Limpar</button>
                    </div>
                </div>

                <div class="mb-2 text-muted small">${resumoTexto}</div>
                ${renderResumoMensal(getVendasPorMes(vendas))}
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
                                vendasVisiveis.length > 0
                                    ? vendasVisiveis.map(v => `
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
                ${hasMais ? `
                    <div class="d-flex justify-content-center mt-3">
                        <button class="btn btn-outline-primary" onclick="toggleVendasMais()">
                            Mostrar ${ocultas} vendas anteriores
                        </button>
                    </div>
                ` : ''}
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
