# Análise 2 — Contrato interno + validações mínimas do Layout Base

## Diagnóstico curto do problema
- A tela permitia ambiguidade no mapeamento por não exibir explicitamente o tipo **Contrato interno** para contexto operacional.
- O botão de salvar não validava a regra mínima estrutural do layout base (exatamente 1 `Contrato vinculado` e 1 `Nota fiscal`), permitindo configurações inválidas para etapas posteriores.

## Arquivos alterados
- `src/pages/Configuracoes.tsx`

## O que foi ajustado
1. **Novo tipo de coluna**
   - Inclusão de `Contrato interno` no seletor de tipo.
   - Inclusão da semântica de `Contrato interno` como **Detalhe / exibição**.
   - Comentário no código explicando diferença entre:
     - `Contrato vinculado` (estrutural da chave)
     - `Contrato interno` (referência interna Maxys, apenas informativa)

2. **Validação mínima ao salvar mapeamento da Base**
   - Implementado `handleSaveBaseMapping` no botão **Salvar Mapeamento**.
   - Regra aplicada:
     - exatamente 1 coluna `Contrato vinculado`
     - exatamente 1 coluna `Nota fiscal`
   - Quando inválido:
     - bloqueia o salvamento lógico
     - exibe mensagens claras na própria tela
   - Quando válido:
     - exibe feedback curto de mapeamento válido

## O que propositalmente não foi alterado
- Backend
- Banco de dados
- Lógica de importação
- Lógica de matching
- Diagnóstico/conferência
- Outras rotas
- Arquitetura geral da página

## Validação final
- `Contrato interno` ficou apenas como campo informativo/de exibição.
- A chave do sistema permaneceu inalterada: `contrato_vinculado + nota_fiscal`.
- A validação mínima da tela passou a exigir exatamente 1 `Contrato vinculado` e 1 `Nota fiscal` antes de salvar.
