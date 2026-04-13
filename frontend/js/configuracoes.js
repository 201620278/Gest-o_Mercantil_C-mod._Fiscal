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
                <p><strong>Desenvolvido por:</strong> Cicero Diego</p>
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
            renderFiscalConfiguracao(fiscal || {});
        },
        error: function() {
            $('#fiscal-config-section').html('<div class="alert alert-danger mt-3">Erro ao carregar configuração fiscal.</div>');
        }
    });
}

function perfilFiscalVazio() {
    return {
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        ie: '',
        crt: 1,
        cnae_principal: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        municipio: '',
        codigo_municipio: '',
        uf: 'CE',
        serie_nfce: 1,
        proximo_numero_nfce: 1,
        CSC: '',
        CSC_ID: '',
        certificado_path: '',
        certificado_validade_inicio: '',
        certificado_validade_fim: '',
        certificado_serial: ''
    };
}

function renderFiscalConfiguracao(payload) {
    const ambienteAtivo = payload.ambiente_ativo || payload.ambiente || 'homologacao';
    const perfis = payload.perfis || {
        homologacao: payload.ambiente === 'homologacao' ? payload : null,
        producao: payload.ambiente === 'producao' ? payload : null
    };

    const homologacao = Object.assign(perfilFiscalVazio(), perfis.homologacao || {});
    const producao = Object.assign(perfilFiscalVazio(), perfis.producao || {});

    const html = `
        <div class="card mt-3">
            <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div><i class="fas fa-file-invoice"></i> Configuração Fiscal Administrável</div>
                <div class="d-flex align-items-center gap-2">
                    <label class="small text-muted mb-0">Ambiente ativo</label>
                    <select class="form-select form-select-sm" id="fiscal_ambiente_ativo" style="width: 170px;">
                        <option value="homologacao" ${ambienteAtivo === 'homologacao' ? 'selected' : ''}>Homologação</option>
                        <option value="producao" ${ambienteAtivo === 'producao' ? 'selected' : ''}>Produção</option>
                    </select>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="salvarAmbienteFiscalAtivo()">Aplicar</button>
                </div>
            </div>
            <div class="card-body">
                <p class="text-muted small mb-3">Agora o módulo fiscal não depende mais de alteração na raiz do sistema. Você configura os perfis de homologação e produção por aqui.</p>
                <ul class="nav nav-tabs" id="fiscalTabs" role="tablist">
                    <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-fiscal-homologacao" type="button">Homologação</button></li>
                    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-fiscal-producao" type="button">Produção</button></li>
                </ul>
                <div class="tab-content border border-top-0 p-3">
                    ${renderFiscalPerfilTab('homologacao', homologacao, ambienteAtivo)}
                    ${renderFiscalPerfilTab('producao', producao, ambienteAtivo)}
                </div>
            </div>
        </div>
    `;
    $('#fiscal-config-section').html(html);
}

function renderFiscalPerfilTab(ambiente, fiscal, ambienteAtivo) {
    const titulo = ambiente === 'homologacao' ? 'Perfil de Homologação' : 'Perfil de Produção';
    const ativoBadge = ambiente === ambienteAtivo ? '<span class="badge bg-success ms-2">Ativo</span>' : '';
    return `
        <div class="tab-pane fade ${ambiente === 'homologacao' ? 'show active' : ''}" id="tab-fiscal-${ambiente}">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h6 class="mb-0">${titulo} ${ativoBadge}</h6>
                <div class="text-muted small">Certificado: ${fiscal.certificado_path ? 'cadastrado' : 'não enviado'}</div>
            </div>
            <form id="configFiscalForm_${ambiente}">
                <div class="row">
                    <div class="col-md-6 mb-3"><label class="form-label">Razão social</label><input type="text" class="form-control" id="${ambiente}_razao_social" value="${escapeHtml(fiscal.razao_social || '')}"></div>
                    <div class="col-md-6 mb-3"><label class="form-label">Nome fantasia</label><input type="text" class="form-control" id="${ambiente}_nome_fantasia" value="${escapeHtml(fiscal.nome_fantasia || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">CNPJ</label><input type="text" class="form-control" id="${ambiente}_cnpj" value="${escapeHtml(fiscal.cnpj || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">IE</label><input type="text" class="form-control" id="${ambiente}_ie" value="${escapeHtml(fiscal.ie || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">CRT</label><input type="number" class="form-control" id="${ambiente}_crt" value="${escapeHtml(fiscal.crt || '1')}"></div>
                    <div class="col-md-6 mb-3"><label class="form-label">CNAE principal</label><input type="text" class="form-control" id="${ambiente}_cnae_principal" value="${escapeHtml(fiscal.cnae_principal || '')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">UF</label><input type="text" class="form-control" id="${ambiente}_uf" value="${escapeHtml(fiscal.uf || 'CE')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">CEP</label><input type="text" class="form-control" id="${ambiente}_cep" value="${escapeHtml(fiscal.cep || '')}"></div>
                    <div class="col-md-5 mb-3"><label class="form-label">Logradouro</label><input type="text" class="form-control" id="${ambiente}_logradouro" value="${escapeHtml(fiscal.logradouro || '')}"></div>
                    <div class="col-md-2 mb-3"><label class="form-label">Número</label><input type="text" class="form-control" id="${ambiente}_numero" value="${escapeHtml(fiscal.numero || '')}"></div>
                    <div class="col-md-5 mb-3"><label class="form-label">Complemento</label><input type="text" class="form-control" id="${ambiente}_complemento" value="${escapeHtml(fiscal.complemento || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Bairro</label><input type="text" class="form-control" id="${ambiente}_bairro" value="${escapeHtml(fiscal.bairro || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Município</label><input type="text" class="form-control" id="${ambiente}_municipio" value="${escapeHtml(fiscal.municipio || '')}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Código IBGE</label><input type="text" class="form-control" id="${ambiente}_codigo_municipio" value="${escapeHtml(fiscal.codigo_municipio || '')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">Série NFC-e</label><input type="number" class="form-control" id="${ambiente}_serie_nfce" value="${escapeHtml(fiscal.serie_nfce || '1')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">Próximo número</label><input type="number" class="form-control" id="${ambiente}_proximo_numero_nfce" value="${escapeHtml(fiscal.proximo_numero_nfce || '1')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">CSC</label><input type="text" class="form-control" id="${ambiente}_CSC" value="${escapeHtml(fiscal.CSC || '')}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">ID CSC</label><input type="text" class="form-control" id="${ambiente}_CSC_ID" value="${escapeHtml(fiscal.CSC_ID || '')}"></div>
                </div>
                <div class="row align-items-end">
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Enviar certificado A1 (.pfx)</label>
                        <input type="file" class="form-control" id="${ambiente}_certificado_arquivo" accept=".pfx,.p12">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label">Senha do certificado</label>
                        <input type="password" class="form-control" id="${ambiente}_certificado_senha" value="">
                    </div>
                    <div class="col-md-5 mb-3 small text-muted">
                        ${fiscal.certificado_path ? '<div><strong>Arquivo:</strong> cadastrado</div>' : '<div>Nenhum certificado enviado.</div>'}
                        ${fiscal.certificado_serial ? `<div><strong>Série:</strong> ${escapeHtml(fiscal.certificado_serial)}</div>` : ''}
                        ${fiscal.certificado_validade_fim ? `<div><strong>Validade:</strong> ${formatDateTime(fiscal.certificado_validade_fim)}</div>` : ''}
                    </div>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary" onclick="saveFiscalConfiguracoes('${ambiente}')"><i class="fas fa-save"></i> Salvar perfil</button>
                    <button type="button" class="btn btn-outline-secondary" onclick="uploadCertificadoFiscal('${ambiente}')"><i class="fas fa-upload"></i> Enviar certificado</button>
                    <button type="button" class="btn btn-outline-info" onclick="testarCertificadoFiscal('${ambiente}')"><i class="fas fa-vial"></i> Testar certificado</button>
                    <button type="button" class="btn btn-outline-success" onclick="testarProntidaoFiscal('${ambiente}')"><i class="fas fa-check-circle"></i> Ver prontidão</button>
                </div>
            </form>
        </div>
    `;
}

function coletarDadosFiscal(ambiente) {
    return {
        ambiente,
        razao_social: ($(`#${ambiente}_razao_social`).val() || '').trim(),
        nome_fantasia: ($(`#${ambiente}_nome_fantasia`).val() || '').trim(),
        cnpj: ($(`#${ambiente}_cnpj`).val() || '').trim(),
        ie: ($(`#${ambiente}_ie`).val() || '').trim(),
        crt: parseInt($(`#${ambiente}_crt`).val(), 10) || 1,
        cnae_principal: ($(`#${ambiente}_cnae_principal`).val() || '').trim(),
        cep: ($(`#${ambiente}_cep`).val() || '').trim(),
        logradouro: ($(`#${ambiente}_logradouro`).val() || '').trim(),
        numero: ($(`#${ambiente}_numero`).val() || '').trim(),
        complemento: ($(`#${ambiente}_complemento`).val() || '').trim(),
        bairro: ($(`#${ambiente}_bairro`).val() || '').trim(),
        municipio: ($(`#${ambiente}_municipio`).val() || '').trim(),
        codigo_municipio: ($(`#${ambiente}_codigo_municipio`).val() || '').trim(),
        uf: ($(`#${ambiente}_uf`).val() || '').trim().toUpperCase(),
        serie_nfce: parseInt($(`#${ambiente}_serie_nfce`).val(), 10) || 1,
        proximo_numero_nfce: parseInt($(`#${ambiente}_proximo_numero_nfce`).val(), 10) || 1,
        CSC: ($(`#${ambiente}_CSC`).val() || '').trim(),
        CSC_ID: ($(`#${ambiente}_CSC_ID`).val() || '').trim()
    };
}

function saveFiscalConfiguracoes(ambiente) {
    const data = coletarDadosFiscal(ambiente);
    $.ajax({
        url: `${API_URL}/fiscal/config`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(resp) {
            showNotification(resp.message || 'Configuração fiscal salva com sucesso!');
            loadFiscalConfiguracao();
        },
        error: function(xhr) {
            const detalhes = xhr.responseJSON?.validationErrors?.join(' | ');
            showNotification(`Erro ao salvar perfil ${ambiente}: ${detalhes || xhr.responseJSON?.error || 'Erro desconhecido'}`, 'danger');
        }
    });
}

function salvarAmbienteFiscalAtivo() {
    const ambiente = $('#fiscal_ambiente_ativo').val();
    $.ajax({
        url: `${API_URL}/fiscal/config/ambiente-ativo`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ ambiente }),
        success: function(resp) {
            showNotification(resp.message || 'Ambiente fiscal atualizado.');
            loadFiscalConfiguracao();
        },
        error: function(xhr) {
            showNotification(xhr.responseJSON?.error || 'Erro ao alterar ambiente fiscal ativo.', 'danger');
        }
    });
}

function uploadCertificadoFiscal(ambiente) {
    const input = document.getElementById(`${ambiente}_certificado_arquivo`);
    const senha = ($(`#${ambiente}_certificado_senha`).val() || '').trim();
    if (!input || !input.files || !input.files.length) {
        showNotification('Selecione o arquivo do certificado.', 'warning');
        return;
    }
    if (!senha) {
        showNotification('Informe a senha do certificado antes do upload.', 'warning');
        return;
    }
    const formData = new FormData();
    formData.append('certificado', input.files[0]);
    formData.append('senha', senha);
    formData.append('ambiente', ambiente);
    $.ajax({
        url: `${API_URL}/fiscal/config/certificado`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(resp) {
            showNotification(resp.message || 'Certificado enviado com sucesso!');
            loadFiscalConfiguracao();
        },
        error: function(xhr) {
            showNotification(xhr.responseJSON?.error || 'Erro ao enviar certificado.', 'danger');
        }
    });
}

function testarCertificadoFiscal(ambiente) {
    $.ajax({
        url: `${API_URL}/fiscal/config/certificado/testar?ambiente=${ambiente}`,
        method: 'GET',
        success: function(resp) {
            const validade = resp.certificado?.validTo ? ` Validade: ${formatDateTime(resp.certificado.validTo)}.` : '';
            showNotification(`Certificado ${ambiente} válido.${validade}`);
        },
        error: function(xhr) {
            showNotification(xhr.responseJSON?.error || 'Erro ao testar certificado.', 'danger');
        }
    });
}

function testarProntidaoFiscal(ambiente) {
    $.ajax({
        url: `${API_URL}/fiscal/config/prontidao?ambiente=${ambiente}`,
        method: 'GET',
        success: function(resp) {
            if (resp.ok) {
                showNotification(`Perfil ${ambiente} pronto para emissão NFC-e.`);
            } else {
                showNotification(`Pendências em ${ambiente}: ${resp.pendencias.join(' | ')}`, 'warning');
            }
        },
        error: function(xhr) {
            showNotification(xhr.responseJSON?.error || 'Erro ao validar prontidão fiscal.', 'danger');
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