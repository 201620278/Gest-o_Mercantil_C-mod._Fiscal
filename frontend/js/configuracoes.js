function isAdminUser() {
    try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        return u.role === 'admin';
    } catch (e) {
        return false;
    }
}

// Load configuracoes page
function loadConfiguracoes() {
    $.ajax({
        url: `${API_URL}/configuracoes`,
        method: 'GET',
        success: function(configuracoes) {
            if (isAdminUser()) {
                $.ajax({
                    url: `${API_URL}/auth/usuarios`,
                    method: 'GET',
                    success: function(usuarios) {
                        renderConfiguracoes(configuracoes, usuarios);
                    },
                    error: function() {
                        renderConfiguracoes(configuracoes, null);
                    }
                });
            } else {
                renderConfiguracoes(configuracoes, null);
            }
        },
        error: function() {
            $('#page-content').html('<div class="alert alert-danger">Erro ao carregar configurações!</div>');
        }
    });
}

// Render configuracoes
function renderConfiguracoes(configuracoes, usuarios) {
    let currentUsername = '';
    try {
        currentUsername = JSON.parse(localStorage.getItem('user') || '{}').username || '';
    } catch (e) {}

    const blocoUsuarios = usuarios && isAdminUser() ? `
        <div class="card mt-3">
            <div class="card-header">
                <i class="fas fa-user-shield"></i> Usuários do sistema
            </div>
            <div class="card-body">
                <p class="text-muted small">Apenas o administrador pode cadastrar ou remover usuários. O operador acessa o mesmo sistema, sem esta seção.</p>
                <div class="table-responsive mb-3">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>Perfil</th>
                                <th>Cadastro</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${usuarios.map(u => `
                                <tr>
                                    <td>${escapeHtml(u.username)}</td>
                                    <td><span class="badge bg-${u.role === 'admin' ? 'danger' : 'secondary'}">${u.role === 'admin' ? 'Administrador' : 'Operador'}</span></td>
                                    <td>${u.created_at ? formatDateTime(u.created_at) : '-'}</td>
                                    <td>
                                        ${u.username !== JSON.parse(localStorage.getItem('user') || '{}').username ? `
                                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="excluirUsuarioSistema(${u.id}, '${escapeHtml(u.username).replace(/'/g, "\\'")}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : '<span class="text-muted small">você</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-primary btn-sm" onclick="showModalNovoUsuario()">
                    <i class="fas fa-user-plus"></i> Novo usuário
                </button>
            </div>
        </div>
    ` : '';

    const html = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-cog"></i> Configurações do Sistema
            </div>
            <div class="card-body">
                <form id="configForm">
                    ${configuracoes.map(config => `
                        <div class="mb-3">
                            <label for="${config.chave}" class="form-label">${config.descricao || config.chave}</label>
                            ${renderConfigField(config)}
                            <small class="text-muted">${config.chave}</small>
                        </div>
                    `).join('')}
                    
                    <button type="button" class="btn btn-primary" onclick="saveConfiguracoes()">
                        <i class="fas fa-save"></i> Salvar Configurações
                    </button>
                </form>
            </div>
        </div>

        <div id="fiscal-config-section"></div>
        
        <div class="card mt-3">
            <div class="card-header">
                <i class="fas fa-database"></i> Backup e Manutenção
            </div>
            <div class="card-body">
                <button class="btn btn-info" onclick="fazerBackup()">
                    <i class="fas fa-download"></i> Fazer Backup
                </button>
                <button class="btn btn-warning ms-2" onclick="limparCache()">
                    <i class="fas fa-trash"></i> Limpar Cache
                </button>
                <button onclick="salvarBackupConfig()">Salvar Configuração de Backup</button>
                <button onclick="backupManual()">Backup Manual Agora</button>
            </div>
        </div>
        
        <div class="card mt-3">
            <div class="card-header">
                <i class="fas fa-info-circle"></i> Informações do Sistema
            </div>
            <div class="card-body">
                <p><strong>Versão:</strong> 1.0.0</p>
                <p><strong>Data de Instalação:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Desenvolvido por:</strong> Mercadão da Economia</p>
            </div>
        </div>
        ${blocoUsuarios}
    `;
    
    $('#page-content').html(html);
    loadFiscalConfiguracao();
}

function loadFiscalConfiguracao() {
    $.ajax({
        url: `${API_URL}/fiscal/config`,
        method: 'GET',
        success: function(fiscal) {
            renderFiscalConfiguracao(fiscal);
        },
        error: function() {
            $('#fiscal-config-section').html('<div class="alert alert-danger mt-3">Erro ao carregar configuração fiscal.</div>');
        }
    });
}

function renderFiscalConfiguracao(fiscal) {
    fiscal = fiscal || {};
    const html = `
        <div class="card mt-3">
            <div class="card-header">
                <button class="btn btn-link text-decoration-none p-0" type="button" data-bs-toggle="collapse" data-bs-target="#fiscalConfigSection" aria-expanded="true" aria-controls="fiscalConfigSection">
                    <i class="fas fa-file-invoice"></i> Configuração Fiscal
                </button>
            </div>
            <div id="fiscalConfigSection" class="collapse show">
                <div class="card-body">
                    <form id="configFiscalForm">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Razão social</label>
                                <input type="text" class="form-control" id="fiscal_razao_social" value="${escapeHtml(fiscal.razao_social || 'ESQUINAO DA ECONOMIA LTDA')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Nome fantasia</label>
                                <input type="text" class="form-control" id="fiscal_nome_fantasia" value="${escapeHtml(fiscal.nome_fantasia || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">CNPJ</label>
                                <input type="text" class="form-control" id="fiscal_cnpj" value="${escapeHtml(fiscal.cnpj || '65.957.340/0001-50')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">IE</label>
                                <input type="text" class="form-control" id="fiscal_ie" value="${escapeHtml(fiscal.ie || '07.325263-8')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">CRT</label>
                                <input type="number" class="form-control" id="fiscal_crt" value="${escapeHtml(fiscal.crt || '1')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">CNAE principal</label>
                                <input type="text" class="form-control" id="fiscal_cnae_principal" value="${escapeHtml(fiscal.cnae_principal || '')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Ambiente</label>
                                <select class="form-control" id="fiscal_ambiente">
                                    <option value="homologacao" ${fiscal.ambiente === 'homologacao' ? 'selected' : ''}>Homologação</option>
                                    <option value="producao" ${fiscal.ambiente === 'producao' ? 'selected' : ''}>Produção</option>
                                </select>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label class="form-label">CEP</label>
                                <input type="text" class="form-control" id="fiscal_cep" value="${escapeHtml(fiscal.cep || '')}">
                            </div>
                            <div class="col-md-5 mb-3">
                                <label class="form-label">Logradouro</label>
                                <input type="text" class="form-control" id="fiscal_logradouro" value="${escapeHtml(fiscal.logradouro || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Número</label>
                                <input type="text" class="form-control" id="fiscal_numero" value="${escapeHtml(fiscal.numero || '')}">
                            </div>
                            <div class="col-md-3 mb-3">
                                <label class="form-label">Complemento</label>
                                <input type="text" class="form-control" id="fiscal_complemento" value="${escapeHtml(fiscal.complemento || '')}">
                            </div>
                            <div class="col-md-5 mb-3">
                                <label class="form-label">Bairro</label>
                                <input type="text" class="form-control" id="fiscal_bairro" value="${escapeHtml(fiscal.bairro || '')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Município</label>
                                <input type="text" class="form-control" id="fiscal_municipio" value="${escapeHtml(fiscal.municipio || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Código IBGE</label>
                                <input type="text" class="form-control" id="fiscal_codigo_municipio" value="${escapeHtml(fiscal.codigo_municipio || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">UF</label>
                                <input type="text" class="form-control" id="fiscal_uf" value="${escapeHtml(fiscal.uf || '')}">
                            </div>
                            <div class="col-md-2 mb-3">
                                <label class="form-label">Série NFC-e</label>
                                <input type="number" class="form-control" id="fiscal_serie_nfce" value="${escapeHtml(fiscal.serie_nfce || '1')}">
                            </div>
                            <div class="col-md-2 mb-3">
                                <label class="form-label">Próximo número</label>
                                <input type="number" class="form-control" id="fiscal_proximo_numero_nfce" value="${escapeHtml(fiscal.proximo_numero_nfce || '1')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">CSC</label>
                                <input type="text" class="form-control" id="fiscal_CSC" value="${escapeHtml(fiscal.CSC || '')}">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">ID CSC</label>
                                <input type="text" class="form-control" id="fiscal_CSC_ID" value="${escapeHtml(fiscal.CSC_ID || '')}">
                            </div>
                            <div class="col-md-8 mb-3">
                                <label class="form-label">Caminho do certificado</label>
                                <input type="text" class="form-control" id="fiscal_certificado_path" value="${escapeHtml(fiscal.certificado_path || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Senha do certificado</label>
                                <input type="password" class="form-control" id="fiscal_certificado_senha" value="${escapeHtml(fiscal.certificado_senha || '')}">
                            </div>
                        </div>

                        <button type="button" class="btn btn-primary" onclick="saveFiscalConfiguracoes()">
                            <i class="fas fa-save"></i> Salvar Configuração Fiscal
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    $('#fiscal-config-section').html(html);
}

function saveFiscalConfiguracoes() {
    const data = {
        razao_social: ($('#fiscal_razao_social').val() || '').trim(),
        nome_fantasia: ($('#fiscal_nome_fantasia').val() || '').trim(),
        cnpj: ($('#fiscal_cnpj').val() || '').trim(),
        ie: ($('#fiscal_ie').val() || '').trim(),
        crt: parseInt($('#fiscal_crt').val(), 10) || 1,
        cnae_principal: ($('#fiscal_cnae_principal').val() || '').trim(),
        cep: ($('#fiscal_cep').val() || '').trim(),
        logradouro: ($('#fiscal_logradouro').val() || '').trim(),
        numero: ($('#fiscal_numero').val() || '').trim(),
        complemento: ($('#fiscal_complemento').val() || '').trim(),
        bairro: ($('#fiscal_bairro').val() || '').trim(),
        municipio: ($('#fiscal_municipio').val() || '').trim(),
        codigo_municipio: ($('#fiscal_codigo_municipio').val() || '').trim(),
        uf: ($('#fiscal_uf').val() || '').trim(),
        ambiente: ($('#fiscal_ambiente').val() || 'homologacao'),
        serie_nfce: parseInt($('#fiscal_serie_nfce').val(), 10) || 1,
        proximo_numero_nfce: parseInt($('#fiscal_proximo_numero_nfce').val(), 10) || 1,
        CSC: ($('#fiscal_CSC').val() || '').trim(),
        CSC_ID: ($('#fiscal_CSC_ID').val() || '').trim(),
        certificado_path: ($('#fiscal_certificado_path').val() || '').trim(),
        certificado_senha: ($('#fiscal_certificado_senha').val() || '').trim()
    };

    $.ajax({
        url: `${API_URL}/fiscal/config`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function() {
            showNotification('Configuração fiscal salva com sucesso!');
            loadFiscalConfiguracao();
        },
        error: function(xhr) {
            showNotification('Erro ao salvar configuração fiscal: ' + (xhr.responseJSON?.error || 'Erro desconhecido'), 'danger');
        }
    });
}

function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function showModalNovoUsuario() {
    const modalHtml = `
        <div class="modal fade" id="novoUsuarioModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Novo usuário</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Nome de usuário</label>
                            <input type="text" class="form-control" id="novo_usuario_login" autocomplete="off">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Senha (mín. 4 caracteres)</label>
                            <input type="password" class="form-control" id="novo_usuario_senha" autocomplete="new-password">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Perfil</label>
                            <select class="form-control" id="novo_usuario_role">
                                <option value="operador">Operador</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <div id="novo-usuario-erro" class="alert alert-danger py-2 d-none"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarNovoUsuario()">Cadastrar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#modal-container').html(modalHtml);
    $('#novoUsuarioModal').modal('show');
}

function salvarNovoUsuario() {
    const username = $('#novo_usuario_login').val().trim();
    const password = $('#novo_usuario_senha').val();
    const role = $('#novo_usuario_role').val();
    const $err = $('#novo-usuario-erro');
    $err.addClass('d-none').text('');

    if (!username || !password) {
        $err.removeClass('d-none').text('Preencha usuário e senha.');
        return;
    }

    $.ajax({
        url: `${API_URL}/auth/usuarios`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, password, role }),
        success: function() {
            $('#novoUsuarioModal').modal('hide');
            showNotification('Usuário cadastrado com sucesso!');
            loadConfiguracoes();
        },
        error: function(xhr) {
            $err.removeClass('d-none').text(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Erro ao cadastrar.');
        }
    });
}

function excluirUsuarioSistema(id) {
    if (!confirm('Remover este usuário? Esta ação não pode ser desfeita.')) return;
    $.ajax({
        url: `${API_URL}/auth/usuarios/${id}`,
        method: 'DELETE',
        success: function() {
            showNotification('Usuário removido.');
            loadConfiguracoes();
        },
        error: function(xhr) {
            showNotification(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Erro ao remover.', 'danger');
        }
    });
}

// Render config field based on type
function renderConfigField(config) {
    const value = config.valor || '';
    
    switch(config.tipo) {
        case 'boolean':
            return `
                <select class="form-control" id="${config.chave}">
                    <option value="true" ${value === 'true' ? 'selected' : ''}>Sim</option>
                    <option value="false" ${value === 'false' ? 'selected' : ''}>Não</option>
                </select>
            `;
        case 'text':
            return `<textarea class="form-control" id="${config.chave}" rows="3">${value}</textarea>`;
        default:
            return `<input type="text" class="form-control" id="${config.chave}" value="${value}">`;
    }
}

// Save configuracoes
function saveConfiguracoes() {
    const configs = [];
    
    $('#configForm .form-control').each(function() {
        const chave = $(this).attr('id');
        const valor = $(this).val();
        if (!chave) return;

        configs.push({
            chave: chave,
            valor: valor
        });
    });
    
    let promises = [];
    
    configs.forEach(config => {
        const promise = $.ajax({
            url: `${API_URL}/configuracoes/${config.chave}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ valor: config.valor })
        });
        promises.push(promise);
    });
    
    Promise.all(promises)
        .then(() => {
            showNotification('Configurações salvas com sucesso!');
            loadConfiguracoes();
        })
        .catch(() => {
            showNotification('Erro ao salvar configurações!', 'danger');
        });
}

// Fazer backup
function fazerBackup() {
    const data = {
        produtos: null,
        clientes: null,
        vendas: null,
        compras: null,
        financeiro: null
    };
    
    // Fetch all data
    const promises = [
        $.ajax({ url: `${API_URL}/produtos`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/clientes`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/vendas`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/compras`, method: 'GET' }),
        $.ajax({ url: `${API_URL}/financeiro`, method: 'GET' })
    ];
    
    Promise.all(promises)
        .then(([produtos, clientes, vendas, compras, financeiro]) => {
            const backup = {
                data: new Date().toISOString(),
                produtos: produtos,
                clientes: clientes,
                vendas: vendas,
                compras: compras,
                financeiro: financeiro
            };
            
            const backupStr = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showNotification('Backup gerado com sucesso!');
        })
        .catch(() => {
            showNotification('Erro ao gerar backup!', 'danger');
        });
}

// Limpar cache
function limparCache() {
    if (confirm('Tem certeza que deseja limpar o cache do sistema? Isso pode melhorar o desempenho. (Sua sessão de login será mantida.)')) {
        // Limpar sessionStorage
        sessionStorage.clear();
        
        // Limpar cache do navegador
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
        
        showNotification('Cache limpo com sucesso!');
        
        // Recarregar página
        setTimeout(() => {
            location.reload();
        }, 1500);
    }
}