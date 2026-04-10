# Ajustes aplicados em 2026-04-10

## Fiscal
- Perfil fiscal separado por ambiente: homologação e produção.
- Ambiente ativo configurável pela interface administrativa.
- Upload de certificado por ambiente.
- Teste de certificado por ambiente.
- Verificação de prontidão fiscal por ambiente.
- Emissão NFC-e passa a usar o perfil fiscal ativo.

## Arquivos alterados
- backend/database.js
- backend/rotas/fiscal.js
- backend/services/fiscalService.js
- backend/services/fiscalConfigService.js (novo)
- frontend/js/configuracoes.js
- frontend/js/pdv.js

## Observação
- Esta entrega melhora fortemente a arquitetura do módulo fiscal, mas ainda depende de teste local com as dependências Node instaladas e com o banco real do cliente.
