// Módulo de categorias - CRUD e integração
// Reutilizável e desacoplado

const categoriasAPI = {
  listar: function() {
    return $.ajax({
      url: API_URL + '/categorias',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
  },
  buscar: function(id) {
    return $.ajax({
      url: API_URL + '/categorias/' + id,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
  },
  criar: function(dados) {
    return $.ajax({
      url: API_URL + '/categorias',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(dados),
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
  },
  atualizar: function(id, dados) {
    return $.ajax({
      url: API_URL + '/categorias/' + id,
      method: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(dados),
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
  },
  excluir: function(id) {
    return $.ajax({
      url: API_URL + '/categorias/' + id,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
  }
};

// Função para carregar categorias na tabela
function loadCategorias() {
  categoriasAPI.listar().done(function(categorias) {
    let html = '';
    categorias.forEach(cat => {
      html += `<tr>
        <td>${cat.id}</td>
        <td>${cat.nome}</td>
        <td>${cat.descricao || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editarCategoria(${cat.id})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="excluirCategoria(${cat.id})">Excluir</button>
        </td>
      </tr>`;
    });
    $('#categorias-tbody').html(html);
  });
}

// Função para criar categoria
function criarCategoria() {
  const nome = $('#categoria-nome').val().trim();
  const descricao = $('#categoria-descricao').val().trim();
  if (!nome) {
    alert('Nome é obrigatório!');
    return;
  }
  categoriasAPI.criar({ nome, descricao }).done(() => {
    $('#categoria-nome').val('');
    $('#categoria-descricao').val('');
    loadCategorias();
    $('#modal-categoria').modal('hide');
    // Atualizar select de categorias para subcategoria imediatamente
    if (typeof atualizarSelectCategoriasSubcategoria === 'function') {
      atualizarSelectCategoriasSubcategoria();
    }
  }).fail(err => {
    alert('Erro ao criar categoria: ' + (err.responseJSON?.erro || err.statusText));
  });
}

// Função para editar categoria
function editarCategoria(id) {
  categoriasAPI.buscar(id).done(cat => {
    $('#categoria-id').val(cat.id);
    $('#categoria-nome').val(cat.nome);
    $('#categoria-descricao').val(cat.descricao);
    $('#modal-categoria').modal('show');
  });
}

// Função para salvar edição
function salvarCategoria() {
  const id = $('#categoria-id').val();
  const nome = $('#categoria-nome').val().trim();
  const descricao = $('#categoria-descricao').val().trim();
  if (!nome) {
    alert('Nome é obrigatório!');
    return;
  }
  categoriasAPI.atualizar(id, { nome, descricao }).done(() => {
    $('#modal-categoria').modal('hide');
    $('#categoria-id').val('');
    $('#categoria-nome').val('');
    $('#categoria-descricao').val('');
    loadCategorias();
  }).fail(err => {
    alert('Erro ao atualizar categoria: ' + (err.responseJSON?.erro || err.statusText));
  });
}

// Função para excluir categoria
function excluirCategoria(id) {
  if (!confirm('Deseja realmente excluir esta categoria?')) return;
  categoriasAPI.excluir(id).done(() => {
    loadCategorias();
  }).fail(err => {
    alert('Erro ao excluir categoria: ' + (err.responseJSON?.erro || err.statusText));
  });
}

// Exportar globalmente
window.loadCategorias = loadCategorias;
window.criarCategoria = criarCategoria;
window.editarCategoria = editarCategoria;
window.salvarCategoria = salvarCategoria;
window.excluirCategoria = excluirCategoria;
window.categoriasAPI = categoriasAPI;
