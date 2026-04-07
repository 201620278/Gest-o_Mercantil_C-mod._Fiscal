// API base URL
const API_URL = 'http://localhost:3000/api';



// DEBUG: Mostra o token salvo no localStorage
console.log('Token salvo no localStorage:', localStorage.getItem('token'));

// Global variables
let currentPage = 'pdv';
let chart = null;

// Initialize app
$(document).ready(function() {
    console.log('App inicializado');
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
    switch (page) {
        case 'fornecedores':
            if (typeof loadFornecedores === 'function') {
                loadFornecedores();
            } else {
                console.error('loadFornecedores não está definida');
                $('#page-content').html(`
                    <div class="alert alert-danger">
                        Erro: Módulo de fornecedores não carregado!
                    </div>
                `);
            }
            break;
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
        case 'categorias':
            // Carregar página de categorias
            $.get('categorias.html', function(html) {
                $('#page-content').html(html);
                if (typeof loadCategorias === 'function') {
                    loadCategorias();
                }
            });
            break;
        default:
            // ação padrão
            break;
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

// Garante que o token está sendo enviado em todas as requisições AJAX
$.ajaxSetup({
    beforeSend: function(xhr) {
        const t = localStorage.getItem('token');
        if (t) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + t);
            // DEBUG: Mostra o header Authorization enviado
            console.log('Enviando Authorization:', 'Bearer ' + t);
        }
    }
});