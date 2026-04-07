// API base URL
const API_URL = 'http://localhost:3000/api';

// Global variables
let currentPage = 'pdv';
let chart = null;

// Função para tratar erro 401
function handleUnauthorized() {
    console.log('Erro 401 - Token inválido ou expirado');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Configurar interceptor para todas as requisições AJAX
$(document).ajaxError(function(event, xhr, settings, error) {
    if (xhr.status === 401 || xhr.status === 403) {
        handleUnauthorized();
    }
});

// Initialize app
$(document).ready(function() {
    console.log('App inicializado');
    
    // Verificar se tem token (já verificado no index.html)
    if (!localStorage.getItem('token')) {
        return;
    }
    
    loadPage('pdv');
    
    // Navigation
    $('.nav-link').click(function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        loadPage(page);
        
        // Atualizar classe active
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
    });
});

// Load page content
function loadPage(page) {
    console.log('Carregando página:', page);
    currentPage = page;
    
    switch(page) {
        case 'pdv':
            if (typeof loadPDV === 'function') {
                loadPDV();
            } else {
                console.error('loadPDV não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: PDV não carregado corretamente!</div>');
            }
            break;
        case 'produtos':
            if (typeof loadProdutos === 'function') {
                loadProdutos();
            } else {
                console.error('loadProdutos não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo de produtos não carregado!</div>');
            }
            break;
        case 'clientes':
            if (typeof loadClientes === 'function') {
                loadClientes();
            } else {
                console.error('loadClientes não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo de clientes não carregado!</div>');
            }
            break;
        case 'compras':
            if (typeof loadCompras === 'function') {
                loadCompras();
            } else {
                console.error('loadCompras não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo de compras não carregado!</div>');
            }
            break;
        case 'vendas':
            if (typeof loadVendas === 'function') {
                loadVendas();
            } else {
                console.error('loadVendas não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo de vendas não carregado!</div>');
            }
            break;
        case 'financeiro':
            if (typeof loadFinanceiro === 'function') {
                loadFinanceiro();
            } else {
                console.error('loadFinanceiro não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo financeiro não carregado!</div>');
            }
            break;
        case 'configuracoes':
            if (typeof loadConfiguracoes === 'function') {
                loadConfiguracoes();
            } else {
                console.error('loadConfiguracoes não está definida');
                $('#page-content').html('<div class="alert alert-danger">Erro: Módulo de configurações não carregado!</div>');
            }
            break;
        default:
            $('#page-content').html('<div class="alert alert-danger">Página não encontrada!</div>');
    }
}

// Format currency
function formatCurrency(value) {
    if (value === undefined || value === null) value = 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Format date
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
}

// Format datetime
function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('pt-BR');
}

// Show notification
function showNotification(message, type = 'success') {
    const alertClass = type === 'success' ? 'alert-success' : 
                       type === 'danger' ? 'alert-danger' : 
                       type === 'warning' ? 'alert-warning' : 'alert-info';
    
    const html = `
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999; min-width: 300px;" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('body').append(html);
    
    setTimeout(() => {
        $('.alert').fadeOut('slow', function() {
            $(this).remove();
        });
    }, 3000);
}