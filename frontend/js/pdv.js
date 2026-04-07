// Variáveis globais do PDV

let carrinho = [];
let produtosDisponiveis = [];
let formaPagamentoSelecionada = null;
let vendaPrazoInfo = null;
let debitoAvisoModal = null;

// Inicializar PDV
function loadPDV() {
    console.log('Carregando PDV...');
    
    // Carregar produtos
    $.ajax({
        url: `${API_URL}/produtos`,
        method: 'GET',
        success: function(produtos) {
            produtosDisponiveis = produtos;
            console.log('Produtos carregados:', produtos.length);
            renderPDV();
            
            // Focar no campo de código de barras
            setTimeout(() => {
                const input = $('#codigo-barra');
                if (input.length) {
                    input.focus();
                }
            }, 100);
        },
        error: function(xhr) {
            console.error('Erro ao carregar produtos:', xhr);
            showNotification('Erro ao carregar produtos!', 'danger');
            renderPDV();
        }
    });
}

// Renderizar tela do PDV
function renderPDV() {
    const html = `
        <div class="pdv-container container-fluid" style="max-width: 100vw; min-height: 100vh; overflow-x: hidden;">
            <div class="row g-3 align-items-start">
                <div class="col-lg-3 col-md-4 col-12">
                    <div class="pdv-header text-center mb-3" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border-radius: 10px; padding: 15px;">
                        <h2 style="font-size: 1.6rem; margin-bottom: 0;">Esquinão da economia</h2>
                        <div style="font-size: 1rem;">Operador: <span id="operador-nome">Usuário</span> <span id="data-hora"></span></div>
                    </div>
                    <div class="card p-3 mb-3">
                        <label for="codigo-barra" style="font-weight:bold;">Leitor de Código de Barras</label>
                        <input type="text" class="form-control mb-2" id="codigo-barra" placeholder="Código / Produto" autocomplete="off">
                        <div class="row g-1">
                            ${[7,8,9,'C',4,5,6,'/',1,2,3,'*',0,'.','=','+','-'].map(btn => `
                                <div class="col-3 mb-1">
                                    <button class="btn btn-light w-100 calc-btn" data-value="${btn}" style="padding:6px 0;font-size:1rem;">${btn}</button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-success w-100 mt-2" id="buscar-produto">Buscar</button>
                    </div>
                </div>
                <div class="col-lg-9 col-md-8 col-12">
                    <div class="card mb-3">
                        <div class="card-header" style="font-weight:bold;">
                            Carrinho de Compras
                            <button class="btn btn-sm btn-danger float-end" id="limpar-carrinho">Limpar Carrinho</button>
                        </div>
                        <div class="card-body p-2">
                            <div class="table-responsive">
                                <table class="table table-bordered mb-0">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Qtd</th>
                                            <th>Preço Unit.</th>
                                            <th>Subtotal</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="carrinho-itens">
                                        ${carrinho.length === 0 ? '<tr><td colspan="5" class="text-center">Nenhum item no carrinho</td></tr>' : ''}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                                            <td colspan="2"><strong id="subtotal">R$ 0,00</strong></td>
                                        </tr>
                                        <tr>
                                            <td colspan="3" class="text-end">
                                                <strong>Desconto:</strong>
                                                <input type="number" id="desconto" class="form-control form-control-sm d-inline-block" style="width: 100px;" value="0" step="0.01" min="0">
                                            </td>
                                            <td colspan="2"><strong id="total">R$ 0,00</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="row g-2">
                        <div class="col">
                            <button class="btn btn-danger w-100" id="cancelar-venda">Cancelar Venda</button>
                        </div>
                        <div class="col">
                            <button class="btn btn-success w-100" id="finalizar-venda">Finalizar Venda</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#page-content').html(html);
    
    // Atualizar data e hora
    atualizarDataHora();
    setInterval(atualizarDataHora, 1000);
    
    // Bind de eventos
    $('#codigo-barra').on('keypress', function(e) {
        if (e.which === 13) {
            const codigo = $(this).val().trim();
            if (codigo) {
                adicionarProdutoPorCodigo(codigo);
                $(this).val('');
            }
        }
    });
    
    $('#buscar-produto').on('click', function() {
        const codigo = $('#codigo-barra').val().trim();
        if (codigo) {
            adicionarProdutoPorCodigo(codigo);
            $('#codigo-barra').val('');
        }
    });
    
    $('#limpar-carrinho').on('click', limparCarrinho);
    $('#cancelar-venda').on('click', cancelarVendaAtual);
    $('#finalizar-venda').on('click', abrirModalPagamento);
    
    $('.calc-btn').on('click', function() {
        const valor = $(this).data('value');
        const input = $('#codigo-barra');
        const currentValue = input.val();
        
        if (valor === 'C') {
            input.val('');
        } else if (valor === '=') {
            const codigo = input.val().trim();
            if (codigo) {
                adicionarProdutoPorCodigo(codigo);
                input.val('');
            }
        } else {
            input.val(currentValue + valor);
            input.focus();
        }
    });
    
    $('#desconto').on('input', function() {
        calcularTotal();
    });
}

// Atualizar data e hora
function atualizarDataHora() {
    const agora = new Date();
    const dataHoraStr = agora.toLocaleString('pt-BR');
    $('#data-hora').text(dataHoraStr);
}

// Renderizar itens do carrinho
function renderCarrinhoItens() {
    if (carrinho.length === 0) {
        return '<tr><td colspan="5" class="text-center">Nenhum item no carrinho</td></tr>';
    }
    
    return carrinho.map((item, index) => `
        <tr>
            <td>${escapeHtml(item.nome)}</td>
            <td>
                <input type="number" 
                       class="form-control form-control-sm quantidade-item" 
                       value="${item.quantidade}" 
                       min="0.01" 
                       step="0.01"
                       style="width: 80px"
                       data-index="${index}">
            </td>
            <td>${formatCurrency(item.preco_unitario)}</td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td class="text-center">
                <i class="fas fa-trash item-remover" style="cursor: pointer; color: #dc3545;" data-index="${index}"></i>
            </td>
        </tr>
    `).join('');
}

// Escapar HTML para evitar XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Adicionar produto por código ou nome
function adicionarProdutoPorCodigo(codigo) {
    if (!codigo || codigo.trim() === '') return;
    
    if (!produtosDisponiveis || produtosDisponiveis.length === 0) {
        showNotification('Nenhum produto cadastrado. Cadastre produtos primeiro!', 'warning');
        return;
    }
    
    const codigoBusca = codigo.toString().trim().toLowerCase();
    const produto = produtosDisponiveis.find(p => {
        const cod = (p.codigo || '').toString().trim().toLowerCase();
        const nome = (p.nome || '').toLowerCase();
        return (cod && (cod === codigoBusca || cod.includes(codigoBusca))) || nome.includes(codigoBusca);
    });
    
    if (!produto) {
        showNotification(`Produto não encontrado: ${codigo}`, 'danger');
        return;
    }
    
    // Verificar estoque
    if (produto.estoque_atual <= 0) {
        showNotification(`${produto.nome} - Sem estoque!`, 'danger');
        return;
    }
    
    // Verificar se produto já está no carrinho
    const itemExistente = carrinho.find(item => item.id === produto.id);
    
    if (itemExistente) {
        const novaQuantidade = itemExistente.quantidade + 1;
        if (novaQuantidade > produto.estoque_atual) {
            showNotification(`Estoque insuficiente para ${produto.nome}! Disponível: ${produto.estoque_atual}`, 'danger');
            return;
        }
        itemExistente.quantidade = novaQuantidade;
        itemExistente.subtotal = itemExistente.quantidade * itemExistente.preco_unitario;
        showNotification(`${produto.nome} adicionado! Quantidade: ${novaQuantidade}`, 'success');
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            quantidade: 1,
            preco_unitario: produto.preco_venda,
            subtotal: produto.preco_venda
        });
        showNotification(`${produto.nome} adicionado ao carrinho!`, 'success');
    }
    
    atualizarCarrinho();
}

// Atualizar quantidade de um item
function atualizarQuantidade(index, quantidade) {
    quantidade = parseFloat(quantidade);
    if (isNaN(quantidade)) return;
    
    const item = carrinho[index];
    const produto = produtosDisponiveis.find(p => p.id === item.id);
    
    if (quantidade <= 0) {
        removerItemCarrinho(index);
        return;
    }
    
    if (quantidade > produto.estoque_atual) {
        showNotification(`Estoque insuficiente para ${produto.nome}! Disponível: ${produto.estoque_atual}`, 'danger');
        return;
    }
    
    item.quantidade = quantidade;
    item.subtotal = item.quantidade * item.preco_unitario;
    
    atualizarCarrinho();
}

// Remover item do carrinho
function removerItemCarrinho(index) {
    const item = carrinho[index];
    carrinho.splice(index, 1);
    showNotification(`${item.nome} removido do carrinho!`, 'info');
    atualizarCarrinho();
}

// Limpar carrinho
function limparCarrinho() {
    if (carrinho.length > 0 && confirm('Tem certeza que deseja limpar todo o carrinho?')) {
        carrinho = [];
        formaPagamentoSelecionada = null;
        vendaPrazoInfo = null;
        atualizarCarrinho();
        showNotification('Carrinho limpo!', 'info');
    }
}

// Atualizar carrinho na tela
function atualizarCarrinho() {
    const tbody = $('#carrinho-itens');
    if (tbody.length) {
        tbody.html(renderCarrinhoItens());
        
        // Bind de eventos para os novos inputs
        $('.quantidade-item').off('change').on('change', function() {
            const index = $(this).data('index');
            const novaQuantidade = $(this).val();
            atualizarQuantidade(index, novaQuantidade);
        });
        
        $('.item-remover').off('click').on('click', function() {
            const index = $(this).data('index');
            removerItemCarrinho(index);
        });
    }
    calcularTotal();
}

// Calcular subtotal
function calcularSubtotal() {
    return carrinho.reduce((total, item) => total + item.subtotal, 0);
}

// Calcular total com desconto
function calcularTotalValor() {
    const subtotal = calcularSubtotal();
    const descontoInput = $('#desconto');
    const desconto = descontoInput.length ? (parseFloat(descontoInput.val()) || 0) : 0;
    return Math.max(0, subtotal - desconto);
}

// Calcular e atualizar totais
function calcularTotal() {
    const subtotal = calcularSubtotal();
    const total = calcularTotalValor();
    
    const subtotalSpan = $('#subtotal');
    const totalSpan = $('#total');
    
    if (subtotalSpan.length) subtotalSpan.text(formatCurrency(subtotal));
    if (totalSpan.length) totalSpan.text(formatCurrency(total));
}

// Abrir modal de pagamento
function abrirModalPagamento() {
    if (carrinho.length === 0) {
        showNotification('Adicione itens ao carrinho primeiro!', 'warning');
        return;
    }
    
    const total = calcularTotalValor();
    if (total <= 0) {
        showNotification('Valor total inválido!', 'danger');
        return;
    }
    
    const modalHtml = `
        <div class="modal fade" id="pagamentoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Forma de Pagamento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <h4 class="text-center mb-3">Total: ${formatCurrency(total)}</h4>
                        
                        <div class="payment-methods mb-3">
                            <button class="payment-method-btn btn btn-outline-primary m-1" data-pagamento="dinheiro">
                                <i class="fas fa-money-bill"></i> Dinheiro
                            </button>
                            <button class="payment-method-btn btn btn-outline-primary m-1" data-pagamento="cartao_credito">
                                <i class="fab fa-cc-visa"></i> Cartão Crédito
                            </button>
                            <button class="payment-method-btn btn btn-outline-primary m-1" data-pagamento="cartao_debito">
                                <i class="fas fa-credit-card"></i> Cartão Débito
                            </button>
                            <button class="payment-method-btn btn btn-outline-primary m-1" data-pagamento="pix">
                                <i class="fas fa-qrcode"></i> PIX
                            </button>
                            <button class="payment-method-btn btn btn-outline-primary m-1" data-pagamento="prazo">
                                <i class="fas fa-calendar-alt"></i> A Prazo
                            </button>
                        </div>
                        
                        <div id="troco-area" style="display: none;" class="mt-3">
                            <label for="valor-recebido">Valor Recebido:</label>
                            <input type="number" step="0.01" class="form-control" id="valor-recebido">
                            <div class="mt-2">
                                <strong>Troco: <span id="troco" style="font-size: 1.5rem; color: #28a745;">R$ 0,00</span></strong>
                            </div>
                        </div>
                        
                        <div id="prazo-area" style="display: none;" class="mt-3">
                            <div class="mb-2">
                                <label for="cliente-prazo-busca">Cliente *</label>
                                <input type="text" class="form-control" id="cliente-prazo-busca" placeholder="Digite o nome do cliente">
                                <input type="hidden" id="cliente-prazo-id">
                                <div id="cliente-prazo-sugestoes" class="list-group position-absolute w-100" style="z-index: 9999; display: none;"></div>
                            </div>
                            <div class="mb-2">
                                <label for="parcelas-prazo">Quantidade de Parcelas *</label>
                                <input type="number" min="1" max="24" class="form-control" id="parcelas-prazo" value="1">
                            </div>
                            <div class="mb-2">
                                <label for="primeiro-vencimento-prazo">Primeiro Vencimento *</label>
                                <input type="date" class="form-control" id="primeiro-vencimento-prazo">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="confirmar-pagamento">Confirmar Pagamento</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modalHtml);
    
    const modal = new bootstrap.Modal(document.getElementById('pagamentoModal'));
    modal.show();
    
    formaPagamentoSelecionada = null;
    
    // Evento para selecionar pagamento
    $('.payment-method-btn').off('click').on('click', function() {
        const tipo = $(this).data('pagamento');
        selecionarPagamento(tipo);
    });
    
    // Evento para confirmar pagamento
    $('#confirmar-pagamento').off('click').on('click', confirmarPagamento);
    
    // Evento para calcular troco
    $('#valor-recebido').off('input').on('input', calcularTroco);
}

// Selecionar forma de pagamento
function selecionarPagamento(tipo) {
    formaPagamentoSelecionada = tipo;
    
    $('.payment-method-btn').removeClass('active btn-primary').addClass('btn-outline-primary');
    $(`.payment-method-btn[data-pagamento="${tipo}"]`).removeClass('btn-outline-primary').addClass('active btn-primary');
    
    if (tipo === 'dinheiro') {
        $('#troco-area').show();
        $('#prazo-area').hide();
    } else if (tipo === 'prazo') {
        $('#troco-area').hide();
        $('#prazo-area').show();
        
        // Definir data padrão
        const hoje = new Date();
        const primeiroVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
        if (primeiroVencimento.getMonth() !== (hoje.getMonth() + 1) % 12) {
            primeiroVencimento.setDate(0);
        }
        $('#primeiro-vencimento-prazo').val(primeiroVencimento.toISOString().split('T')[0]);
        
        // Autocomplete de clientes
        $('#cliente-prazo-busca').off('input').on('input', function() {
            const termo = $(this).val().toLowerCase();
            if (termo.length < 2) {
                $('#cliente-prazo-sugestoes').empty().hide();
                $('#cliente-prazo-id').val('');
                return;
            }
            
            $.ajax({
                url: `${API_URL}/clientes`,
                method: 'GET',
                success: function(clientes) {
                    const filtrados = clientes.filter(c => 
                        (c.nome && c.nome.toLowerCase().includes(termo)) ||
                        (c.cpf_cnpj && c.cpf_cnpj.replace(/\D/g, '').includes(termo.replace(/\D/g, '')))
                    );
                    
                    let html = '';
                    filtrados.forEach(c => {
                        html += `<button type="button" class="list-group-item list-group-item-action" data-id="${c.id}" data-nome="${c.nome}">${escapeHtml(c.nome)}${c.cpf_cnpj ? ' - ' + c.cpf_cnpj : ''}</button>`;
                    });
                    $('#cliente-prazo-sugestoes').html(html).show();
                }
            });
        });
        
        $(document).off('click.sugestaoCliente').on('click.sugestaoCliente', '#cliente-prazo-sugestoes button', function() {
            const id = $(this).data('id');
            const nome = $(this).data('nome');
            $('#cliente-prazo-id').val(id);
            $('#cliente-prazo-busca').val(nome);
            $('#cliente-prazo-sugestoes').empty().hide();
        });
    } else {
        $('#troco-area').hide();
        $('#prazo-area').hide();
    }
}

// Calcular troco
function calcularTroco() {
    const total = calcularTotalValor();
    const recebido = parseFloat($('#valor-recebido').val()) || 0;
    const troco = Math.max(0, recebido - total);
    $('#troco').text(formatCurrency(troco));
    
    if (recebido < total && recebido > 0) {
        showNotification('Valor recebido insuficiente!', 'warning');
    }
}

// Confirmar pagamento
function confirmarPagamento() {
    if (!formaPagamentoSelecionada) {
        showNotification('Selecione uma forma de pagamento!', 'warning');
        return;
    }
    
    if (formaPagamentoSelecionada === 'dinheiro') {
        const recebido = parseFloat($('#valor-recebido').val()) || 0;
        const total = calcularTotalValor();
        if (recebido < total) {
            showNotification('Valor recebido insuficiente!', 'danger');
            return;
        }
    }
    
    if (formaPagamentoSelecionada === 'prazo') {
        const clienteId = $('#cliente-prazo-id').val();
        const parcelas = parseInt($('#parcelas-prazo').val()) || 1;
        const primeiroVenc = $('#primeiro-vencimento-prazo').val();
        
        if (!clienteId) {
            showNotification('Selecione um cliente!', 'danger');
            return;
        }
        if (!parcelas || parcelas < 1) {
            showNotification('Informe a quantidade de parcelas!', 'danger');
            return;
        }
        if (!primeiroVenc) {
            showNotification('Informe a data do primeiro vencimento!', 'danger');
            return;
        }
        
        vendaPrazoInfo = {
            cliente_id: parseInt(clienteId),
            parcelas: parcelas,
            primeiro_vencimento: primeiroVenc
        };
    } else {
        vendaPrazoInfo = null;
    }
    
    $('#pagamentoModal').modal('hide');
    finalizarVenda();
}

// Finalizar venda
function finalizarVenda() {
    if (carrinho.length === 0) {
        showNotification('Adicione itens ao carrinho!', 'warning');
        return;
    }
    
    if (!formaPagamentoSelecionada) {
        showNotification('Selecione a forma de pagamento!', 'warning');
        abrirModalPagamento();
        return;
    }
    
    const total = calcularTotalValor();
    const desconto = parseFloat($('#desconto').val()) || 0;
    
    const venda = {
        itens: carrinho.map(item => ({
            produto_id: item.id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            subtotal: item.subtotal
        })),
        total: total,
        desconto: desconto,
        forma_pagamento: formaPagamentoSelecionada
    };
    
    if (formaPagamentoSelecionada === 'prazo' && vendaPrazoInfo) {
        venda.cliente_id = vendaPrazoInfo.cliente_id;
        venda.parcelas = vendaPrazoInfo.parcelas;
        venda.primeiro_vencimento = vendaPrazoInfo.primeiro_vencimento;
    }
    
    showNotification('Processando venda...', 'info');
    
    function enviarVenda(dados, forcar = false) {
        if (forcar) dados.forcar = true;
        
        $.ajax({
            url: `${API_URL}/vendas`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(dados),
            success: function(response) {
                showNotification(`Venda finalizada! Código: ${response.codigo}`, 'success');
                if (confirm('Deseja imprimir o cupom fiscal?')) {
                    imprimirCupomPDV(response.id, dados, total, desconto);
                }
                
                // Resetar estado
                carrinho = [];
                formaPagamentoSelecionada = null;
                vendaPrazoInfo = null;
                $('#desconto').val(0);
                atualizarCarrinho();
                
                // Recarregar produtos para atualizar estoque
                $.ajax({
                    url: `${API_URL}/produtos`,
                    method: 'GET',
                    success: function(produtos) {
                        produtosDisponiveis = produtos;
                    }
                });
            },
            error: function(xhr) {
                if (xhr.status === 409 && xhr.responseJSON && xhr.responseJSON.pode_continuar) {
                    if ($('#modalDebitoAviso').length) return;
                    
                    const totalAberto = parseFloat(xhr.responseJSON.total_em_aberto).toFixed(2);
                    const parcelasVencidas = xhr.responseJSON.parcelas_vencidas;
                    
                    const avisoHtml = `
                        <div class="modal fade" id="modalDebitoAviso" tabindex="-1">
                            <div class="modal-dialog modal-dialog-centered">
                                <div class="modal-content">
                                    <div class="modal-header bg-warning">
                                        <h5 class="modal-title text-dark">Atenção</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body text-center">
                                        <div class="mb-2 text-danger" style="font-size: 1.2rem;">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <p class="mb-2">Cliente possui <b>débito em aberto</b>!</p>
                                        <p>Total em aberto: <b>R$ ${totalAberto}</b><br>Parcelas vencidas: <b>${parcelasVencidas}</b></p>
                                        <p class="mb-0">Deseja continuar mesmo assim?</p>
                                    </div>
                                    <div class="modal-footer justify-content-center">
                                        <button type="button" class="btn btn-success" id="btnDebitoSim">SIM</button>
                                        <button type="button" class="btn btn-danger" data-bs-dismiss="modal">NÃO</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    $('#modal-container').html(avisoHtml);
                    const modal = new bootstrap.Modal(document.getElementById('modalDebitoAviso'));
                    modal.show();
                    
                    $('#btnDebitoSim').off('click').on('click', function() {
                        modal.hide();
                        setTimeout(() => {
                            $('#modalDebitoAviso').remove();
                            enviarVenda(dados, true);
                        }, 300);
                    });
                    
                    $('#modalDebitoAviso').on('hidden.bs.modal', function() {
                        $('#modalDebitoAviso').remove();
                    });
                    
                    return;
                }
                
                console.error('Erro ao finalizar venda:', xhr);
                showNotification('Erro ao finalizar venda: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
            }
        });
    }
    
    enviarVenda(venda);
}

// Cancelar venda atual
function cancelarVendaAtual() {
    if (carrinho.length > 0 && confirm('Tem certeza que deseja cancelar esta venda?')) {
        carrinho = [];
        formaPagamentoSelecionada = null;
        vendaPrazoInfo = null;
        $('#desconto').val(0);
        atualizarCarrinho();
        showNotification('Venda cancelada!', 'info');
    }
}

// Imprimir cupom
function imprimirCupomPDV(vendaId, venda, total, desconto) {
    const dataHora = new Date().toLocaleString('pt-BR');
    const formaPagamentoTexto = {
        'dinheiro': 'Dinheiro',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'pix': 'PIX',
        'prazo': 'A Prazo'
    }[venda.forma_pagamento] || venda.forma_pagamento;
    
    const cupomHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Cupom Fiscal</title>
            <style>
                body {
                    font-family: monospace;
                    width: 80mm;
                    margin: 0 auto;
                    padding: 10px;
                    font-size: 12px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px dashed #000;
                }
                .empresa {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .itens {
                    margin: 15px 0;
                }
                .cupom-item {
                    margin-bottom: 8px;
                    padding-bottom: 5px;
                    border-bottom: 1px dotted #ccc;
                }
                .total {
                    text-align: right;
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px dashed #000;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 10px;
                    border-top: 1px dashed #000;
                    font-size: 10px;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 5px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="empresa">Esquinão da economia</div>
                <div>CNPJ: 00.000.000/0001-00</div>
                <div>${dataHora}</div>
                <div>CUPOM FISCAL</div>
                <div>Venda #${vendaId}</div>
            </div>
            
            <div class="itens">
                ${venda.itens.map(item => {
                    let nome = item.produto_nome;
                    if (!nome && produtosDisponiveis) {
                        const prod = produtosDisponiveis.find(p => p.id === (item.produto_id || item.id));
                        nome = prod ? prod.nome : 'Produto';
                    }
                    return `
                        <div class="cupom-item">
                            ${escapeHtml(nome || 'Produto')}<br>
                            ${item.quantidade} x ${formatCurrency(item.preco_unitario)} = ${formatCurrency(item.subtotal)}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="total">
                Subtotal: ${formatCurrency(total + desconto)}<br>
                Desconto: ${formatCurrency(desconto)}<br>
                <strong>TOTAL: ${formatCurrency(total)}</strong><br>
                Forma Pagamento: ${formaPagamentoTexto}
            </div>
            
            ${vendaPrazoInfo && formaPagamentoSelecionada === 'prazo' ? `
                <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px;">
                    <strong>Venda a Prazo</strong><br>
                    Parcelas: ${vendaPrazoInfo.parcelas}<br>
                    1º Vencimento: ${vendaPrazoInfo.primeiro_vencimento}
                </div>
            ` : ''}
            
            <div class="footer">
                Obrigado pela preferência!<br>
                Volte sempre!<br>
                <strong>Esse Cupom não é válido como documento fiscal</strong>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(cupomHtml);
    printWindow.document.close();
    printWindow.print();
}

// Formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    if (typeof toastr !== 'undefined') {
        toastr[type](message);
    } else {
        alert(message);
    }
}

// Inicializar quando o documento estiver pronto
$(document).ready(function() {
    loadPDV();
});