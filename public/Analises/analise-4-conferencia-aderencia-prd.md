# Análise da tela `/conferencia`

## 1. Arquivos lidos

### PRDs
- `public/PRD/PRD — Sistema de Conferência de Contratos (V6).md`
- `public/PRD/Mini PRD — Tela de Conferência de Contratos.txt`
- `public/PRD/Mini PRD — Tela de Importação de Relatórios.txt`
- `public/PRD/Mini PRD — Esquema de Dados do Sistema.txt`
- `public/PRD/Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
- `public/PRD/Mini PRD — Tela de Layouts Complementares.txt`

### Código inspecionado
- `src/pages/Conferencia.tsx`
- `src/components/StatusBadge.tsx`
- `src/data/mock.ts`
- `supabase/functions/importar-base/index.ts`
- `supabase/migrations/20260415194155_ebdbd5b0-0236-40bf-80ab-fa0d2ca5b432.sql`

## 2. Diagnóstico geral

A tela `/conferencia` está parcialmente aderente ao PRD: ela **não recalcula matching** e usa `conferencia` como fonte de status/origem, porém **não consome exclusivamente `conferencia`** (faz leitura base em `registros_base` e monta o join no frontend). Também há lacunas funcionais importantes: **Exportar desativado**, ausência de colunas de peso previstas e ausência de resumo superior.

## 3. O que está aderente ao PRD

- A tela não executa matching nem diagnóstico secundário explícito no frontend.
- Os status exibidos e filtráveis existem no conjunto oficial: `vinculado`, `aguardando`, `divergente`, `ambiguo`.
- A busca textual usa campos operacionais da tela (contrato e nota).
- A origem exibida vem do campo `origem` da tabela `conferencia` (sem inferência pelo frontend).
- No cenário atual sem complementar importado, o backend de importação da base grava `conferencia.status = aguardando` e `origem = null`, comportamento coerente com o contexto informado.

## 4. O que está incompleto

- Botão **Exportar** está presente, mas desativado (`disabled`) e sem fluxo implementado.
- A tabela não exibe colunas informativas de peso (`Peso Base/Peso Fiscal` e `Peso Complementar/Peso Líquido`) mencionadas no PRD da conferência.
- Não há bloco de resumo no topo (totais por status), descrito no PRD.
- Não há estado orientativo explícito para cenário “sem complementar importado”; hoje o usuário deduz isso apenas pelo volume de “Aguardando”.

## 5. O que está divergente

- Divergência principal: o PRD exige que a tela **consuma exclusivamente `conferencia`**, mas a implementação busca `registros_base` e depois busca `conferencia`, unindo no frontend por `chave_normalizada`.
- Existe regra de fallback no frontend para status inválido/ausente: qualquer valor fora de `vinculado/divergente/ambiguo` vira `aguardando`. Embora defensiva, essa transformação é regra de negócio na camada de exibição.
- O botão **Atualizar** contraria a diretriz textual do mini PRD (“não precisa botão de atualizar”), ainda que tecnicamente ele apenas refaça fetch.

## 6. Riscos encontrados

- **Risco semântico:** ao montar a lista a partir de `registros_base` + mapa de `conferencia`, a tela pode exibir `aguardando` por ausência de linha em `conferencia`, mascarando problemas de materialização.
- **Risco de acoplamento:** a tela depende da existência e consistência simultânea de duas tabelas e de uma chave de junção no frontend.
- **Risco de escalabilidade:** limite fixo de 2000 linhas pode truncar visão operacional sem aviso de paginação/“dados parciais”.
- **Risco de prioridade operacional:** ordenação por `updated_at desc` da base pode esconder divergentes no meio da listagem, reduzindo foco investigativo.
- **Risco de interpretação do usuário:** ausência de mensagem explícita sobre “complementar não importado” pode gerar percepção de erro em massa.

## 7. Origem real dos dados da tela

Hoje a origem da grade é:

1. `registros_base` (campos de identificação e listagem: `id`, `chave_normalizada`, `contrato_vinculado`, `nota_fiscal`), com ordenação por `updated_at desc` e limite 2000.
2. `conferencia` (campos `status` e `origem`) filtrada por `chave_normalizada IN (...)`.
3. Junção final feita no frontend via `Map` por chave.

Conclusão objetiva: a tela **não** lê exclusivamente `conferencia`; ela usa `registros_base` como conjunto principal e enriquece com `conferencia`.

## 8. Presença ou ausência de lógica no frontend

- **Ausência de lógica de matching/diagnóstico:** não há cálculo por nota+placa, não há tentativa de vincular complementar.
- **Presença de regra leve de negócio:**
  - normalização defensiva de status (`normalizarStatus`) para enum interno;
  - fallback para `aguardando` quando status não vem da conferência.

Isso não é matching, mas é uma semântica de decisão local na UI.

## 9. Avaliação dos botões “Atualizar” e “Exportar”

### Atualizar
- Comportamento atual: refaz os dois fetches, seta `loading`, limpa erro anterior e repopula `records`.
- Não recalcula dados, não chama reprocessamento, não altera backend de conferência.
- Conceitualmente: funcional como “refresh”, porém em conflito com o trecho do mini PRD que diz não precisar botão de atualizar.

### Exportar
- Situação atual: botão renderizado, porém desativado.
- Não há exportação implementada; logo não há validação de semântica de exportação neste momento.

## 10. Recomendações mínimas

1. **Alinhar fonte única da tela ao PRD:** trocar para leitura direta da tabela `conferencia` (ou view materializada equivalente oficialmente definida) sem join montado no frontend.
2. **Remover fallback semântico de status no frontend** (ou restringi-lo a tratamento técnico com erro explícito), para não mascarar inconsistência do dado materializado.
3. **Decisão de produto sobre botão Atualizar:**
   - manter como refresh técnico explícito (documentado), ou
   - remover para aderir literalmente ao mini PRD.
4. **Implementar orientação de vazio contextual mínima:** mensagem quando não houver complementar importado, reduzindo ambiguidade operacional.
5. **Planejar ajuste incremental de colunas/resumo** (sem refatoração ampla): incluir pesos informativos e indicadores de topo conforme PRD.
6. **Revisar estratégia de paginação/limite** para evitar truncamento silencioso acima de 2000 linhas.

## 11. Conclusão final

A tela pode continuar evoluindo, mas **não está 100% aderente ao PRD da conferência no ponto estrutural mais crítico**: a origem de dados não é exclusivamente `conferencia`. Não há evidência de recalcular matching no frontend, porém há decisões locais de fallback de status e lacunas funcionais (exportação, colunas informativas, resumo). A recomendação é corrigir primeiro a aderência de fonte/semântica com mudanças mínimas e controladas, antes de expandir funcionalidades visuais.
