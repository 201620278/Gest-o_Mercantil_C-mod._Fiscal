# Alterações urgentes aplicadas

## Fiscal
- Mantida a refatoração administrativa do módulo fiscal.
- Perfis separados por ambiente: homologação e produção.
- Ambiente ativo configurável pelo sistema.
- Certificado e prontidão fiscal por ambiente.

## Autenticação e usuários
- Adicionadas rotas administrativas de usuários:
  - `GET /api/auth/usuarios`
  - `POST /api/auth/usuarios`
  - `DELETE /api/auth/usuarios/:id`
- Apenas administrador pode gerenciar usuários.
- Bloqueio para evitar excluir o próprio usuário logado.

## Configurações
- Corrigida a ordem das rotas de backup em `backend/rotas/configuracoes.js`.
- Antes, `GET /api/configuracoes/backup` podia cair na rota genérica `/:chave`.

## Frontend / navegação
- Refeito `frontend/js/app.js` para estabilizar carregamento dos módulos.
- Corrigido carregamento de páginas de categorias/subcategorias.
- Removido carregamento duplicado inicial do PDV no `index.html`.

## Compras
- Implementada a função `removerItemCompra()` que era chamada pela interface e não existia.
- Re-renderização dos itens e recálculo das parcelas após remoção.

## Categorias
- Corrigido fechamento do modal de categoria.
- Ajustado fluxo para limpar campos e recarregar lista após salvar.

## Validação técnica realizada
- Validação de sintaxe com `node --check` em todos os arquivos `.js` do projeto.

## O que ainda depende de teste local
- Fluxo completo no navegador.
- Integração real com SQLite no seu ambiente.
- Emissão NFC-e com certificado/CSC reais.
