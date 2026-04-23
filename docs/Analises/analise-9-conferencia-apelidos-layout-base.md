# Análise 9 — Conferência com apelidos do layout base

## Diagnóstico

### Sintoma observado
A tela `/conferencia` usa rótulos genéricos (`Contrato`, `Nota Fiscal`, `Placa`, `Data`) e isso gera ambiguidade operacional entre contrato vinculado e contrato interno.

### Onde ocorre
- `src/pages/Conferencia.tsx` (headers da grid e labels do drawer).
- `vw_conferencia_tela` não expunha `clifor` nem `contrato_interno` para diagnóstico no drawer.

### Evidências técnicas
1. A listagem estava fixa com `Contrato`, `Nota Fiscal`, `Placa`, `Data` e sem `clifor`.
2. O drawer não diferenciava explicitamente contrato vinculado vs contrato interno.
3. Já existe `apelido` nas colunas do layout base (`layouts_base_colunas.apelido`) e serviço pronto para leitura (`fetchLayoutBase`).
4. A `data_referencia` já vem da Base em `registros_base` e na view da conferência.

### Causa provável
A tela foi implementada com rótulos estáticos e mínimos para aderir à fonte única via `vw_conferencia_tela`, mas sem integração com os metadados de apelido do layout base.

## Decisão de implementação (mínima e reversível)
1. Manter a estrutura da grid fixa.
2. Resolver apenas os rótulos visuais via apelido (com fallback padrão).
3. Enriquecer a view backend com `contrato_interno` e `clifor` vindos de `dados_originais`, guiados pelo layout base ativo.
4. Não alterar nenhuma regra de status/matching/chave.

## Impacto analisado
- **Ordenação/paginação:** preservadas (order/range em `updated_at`).
- **Exportação:** sem impacto (permanece desativada).
- **Matching/processamento:** sem impacto, pois só houve leitura de campos adicionais e labels visuais.

## Dúvidas estruturais registradas
- O sistema pode ter mais de um layout base marcado como ativo em cenário legado; a view usa `WHERE lb.ativo = true` e agrega por `MAX(...)` para manter comportamento seguro sem quebrar leitura.

## Arquivos envolvidos
- `src/pages/Conferencia.tsx`
- `supabase/migrations/20260423110000_conferencia_labels_contexto_base.sql`
- `public/PRD/PRD — Tela de Conferência.md`
- `public/PRD/Mini PRD — Tela de Conferência de Contratos.txt`
- `public/PRD/Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
