# Ajustes aplicados no financeiro e compras

## O que foi alterado

### Financeiro
- O financeiro agora foi preparado para trabalhar com:
  - `origem` do lançamento (`manual`, `compra`, `venda`, `cancelamento_venda`)
  - `status` (`pendente`, `pago`, `recebido`)
  - `documento`
  - `vencimento`
  - `parcelas`
  - `pessoa_nome`
- Novo resumo com foco em:
  - recebido no período
  - pago no período
  - a receber
  - a pagar
  - saldo realizado
- Inclusão de baixa manual de movimentações pendentes.
- Bloqueio de exclusão direta para lançamentos automáticos de compra/venda.
- Busca auxiliar por número da nota no modal de despesa avulsa.

### Compras
- Compra agora grava também:
  - condição de pagamento (`avista`, `prazo`, `parcelado`)
  - forma de pagamento
  - vencimento
  - parcelas
  - observação
- Ao salvar uma compra, o sistema:
  1. salva a compra
  2. salva os itens
  3. atualiza o estoque
  4. gera automaticamente a despesa no financeiro
- Parcelado gera uma movimentação por parcela.
- À vista gera despesa já baixada como paga.

### Vendas
- Venda à vista gera receita marcada como recebida.
- Venda a prazo gera receitas pendentes por parcela.
- Cancelamento de venda gera lançamento de estorno.

## Arquivos alterados
- `backend/database.js`
- `backend/rotas/financeiro.js`
- `backend/rotas/compras.js`
- `backend/rotas/vendas.js`
- `frontend/js/financeiro.js`
- `frontend/js/compras.js`

## Observação importante
Na primeira execução após os ajustes, o sistema vai adicionar novas colunas no banco automaticamente.
