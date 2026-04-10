// API base URL
const API_URL = 'http://localhost:3000/api';

let currentPage = 'pdv';
let chart = null;

function handleUnauthorized() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

$(document).ajaxError(function(event, xhr) {
    if (xhr && (xhr.status === 401 || xhr.status === 403)) {
        handleUnauthorized();
    }
});

$(document).ready(function() {
    if (!localStorage.getItem('token')) return;

    $('.nav-link').on('click', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        loadPage(page);
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
    });
});

function carregarPaginaHtml(url, callback) {
    $.get(url, function(html) {
        $('#page-content').html(html);
        if (typeof callback === 'function') callback();
    }).fail(function() {
        $('#page-content').html('<div class="alert alert-danger">Erro ao carregar a página solicitada.</div>');
    });
}

function loadPage(page) {
    currentPage = page;
    switch (page) {
        case 'pdv':
            return typeof loadPDV === 'function' ? loadPDV() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar o PDV.</div>');
        case 'produtos':
            return typeof loadProdutos === 'function' ? loadProdutos() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar produtos.</div>');
        case 'clientes':
            return typeof loadClientes === 'function' ? loadClientes() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar clientes.</div>');
        case 'compras':
            return typeof loadCompras === 'function' ? loadCompras() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar compras.</div>');
        case 'fornecedores':
            return typeof loadFornecedores === 'function' ? loadFornecedores() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar fornecedores.</div>');
        case 'vendas':
            return typeof loadVendas === 'function' ? loadVendas() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar histórico de vendas.</div>');
        case 'financeiro':
            return typeof loadFinanceiro === 'function' ? loadFinanceiro() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar financeiro.</div>');
        case 'fiscal':
            return typeof loadFiscal === 'function' ? loadFiscal() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar o módulo fiscal.</div>');
        case 'configuracoes':
            return typeof loadConfiguracoes === 'function' ? loadConfiguracoes() : $('#page-content').html('<div class="alert alert-danger">Erro ao carregar configurações.</div>');
        case 'categorias':
            return carregarPaginaHtml('categorias.html', function() {
                if (typeof loadCategoriasAndSubcategorias === 'function') {
                    loadCategoriasAndSubcategorias();
                } else if (typeof loadCategorias === 'function') {
                    loadCategorias();
                }
            });
        default:
            $('#page-content').html('<div class="alert alert-warning">Página não encontrada.</div>');
    }
}

function formatCurrency(value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) value = 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(value));
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('pt-BR');
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleString('pt-BR');
}

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
        $('body > .alert').first().fadeOut('slow', function() {
            $(this).remove();
        });
    }, 3000);
}

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (settings.url && !settings.url.includes('/api/')) return;
        const token = localStorage.getItem('token');
        if (token) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        }
    }
});
