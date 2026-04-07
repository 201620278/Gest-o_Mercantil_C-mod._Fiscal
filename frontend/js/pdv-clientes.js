// Carregar clientes para venda a prazo no PDV
let clientesPDV = [];
function carregarClientesPDV(callback) {
    if (clientesPDV.length > 0) {
        callback(clientesPDV);
        return;
    }
    $.ajax({
        url: `${API_URL}/clientes`,
        method: 'GET',
        success: function(clientes) {
            clientesPDV = clientes;
            callback(clientes);
        },
        error: function() {
            showNotification('Erro ao carregar clientes!', 'danger');
            callback([]);
        }
    });
}
