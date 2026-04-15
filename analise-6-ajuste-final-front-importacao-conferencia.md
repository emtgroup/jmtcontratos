# Análise 6 — Ajuste final front-end (Importação, Conferência e Layouts)

## Telas/localizações alteradas
- `src/pages/Importacao.tsx`
- `src/pages/Conferencia.tsx`
- `src/pages/Configuracoes.tsx`
- `src/pages/Dashboard.tsx`
- `src/data/mock.ts`

## Diagnóstico curto do problema
- A tela de importação ainda misturava, no mesmo bloco e com o mesmo peso visual, indicadores de carga e status da conferência.
- A conferência tinha pontos de ruído operacional (coluna técnica com destaque alto e nomenclatura de status menos alinhada ao PRD).
- O campo **Análise** no layout base ainda podia gerar leitura equivocada sobre influência em chave/matching.
- Havia pequenas diferenças de vocabulário entre telas (especialmente em “Divergente”).

## O que foi ajustado
- **Importação**:
  - separação visual entre **Resultado da importação** e **Estado atual na conferência**;
  - renomeação de labels para termos mais operacionais e menos ambíguos;
  - reposicionamento de “pendências de layout” para bloco auxiliar, sem competir com os contadores principais.
- **Conferência**:
  - ajuste de nomenclatura para **Contrato Divergente** (filtros/legendas/badge);
  - redução do destaque da coluna técnica de chave;
  - redução de peso visual das colunas de peso fiscal/líquido (mantidas como informativas);
  - motivo mantido curto e de leitura operacional.
- **Layout Base / Complementar**:
  - microcopy adicional para deixar explícito que **Análise não define chave nem matching**;
  - reforço textual de que o usuário mapeia significado e o sistema define comportamento.
- **Dashboard**:
  - ajuste pontual de nomenclatura para manter consistência com conferência/PRD.

## O que propositalmente não foi alterado
- Não foi criada lógica nova de backend, validação funcional nem fluxo adicional.
- Não foram feitas refatorações estruturais (layout global, AppLayout, sidebar/header).
- Não houve redesign de telas, apenas ajustes semânticos e hierárquicos.
- Não foram criados novos componentes para resolver o escopo.

## Pendências para a etapa de back-end
- Implementar persistência real da importação e cálculo dos contadores.
- Aplicar validações obrigatórias de layout (tipos estruturais únicos e campos obrigatórios).
- Popular origem/layout na conferência com dados reais.
- Substituir mocks por dados de API mantendo os contratos visuais ajustados.
