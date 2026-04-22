# Análise 1 — Revisão e Consolidação dos PRDs

## Escopo analisado
Arquivos em `/public/PRD`:
- PRD — Sistema de Conferência de Contratos (V6)
- Mini PRD — Tela de Importação de Relatórios
- Mini PRD — Tela de Conferência de Contratos
- Mini PRD — Esquema de Dados do Sistema
- Mini PRD — Tela de Layout do Relatório Base (GRL053)
- Mini PRD — Tela de Layouts Complementares

---

## Inconsistências encontradas

1. **Estrutura documental inconsistente entre arquivos**
   - Alguns PRDs tinham formato por seções narrativas, outros por listas e comentários de ajuste.
   - Havia trechos fora de bloco, delimitadores markdown abertos/fechados de forma irregular e repetição de conteúdo.

2. **Duplicidade de regras em múltiplos pontos com variação textual**
   - Regras de chave, normalização, origem e diagnóstico apareciam repetidas com pequenas diferenças de redação, aumentando risco de interpretação divergente.

3. **Importação com pontos potencialmente conflitantes**
   - Idempotência estava descrita, mas sem consolidação clara com regras de INSERIR/ATUALIZAR/IGNORAR em todos os documentos.
   - Tipos de “ignorados” apareciam só em parte dos documentos, sem conexão explícita com rastreabilidade.

4. **Conferência e frontend**
   - Regra “frontend sem lógica” existia, porém dispersa. Faltava padronização explícita como regra obrigatória central.

5. **Diagnóstico secundário**
   - Regra de execução condicionada à placa válida já existia, mas estava espalhada em diferentes mini PRDs sem estrutura única.

6. **Ambiguidade entre layouts complementares**
   - Critério de ambiguidade e origem nula existia, porém repetido em múltiplas versões de texto, favorecendo leitura não uniforme.

---

## Lacunas identificadas (e explicitadas nos PRDs revisados)

1. **Persistência de registros complementares sem base**
   - O conjunto atual de PRDs define comportamento como **IGNORAR para conferência**.
   - Foi mantida a interpretação conservadora sem inventar armazenamento paralelo não especificado.

2. **Conferência global vs filtrável**
   - Mantida conferência global derivada da base, com filtragem de visualização na tela (status), sem alterar arquitetura.

3. **Impacto de importação parcial**
   - Consolidado que carga parcial não remove dados e não substitui estado completo.

4. **Reimportação do mesmo arquivo**
   - Consolidado como idempotente: sem mutação de estado quando não há diferença em campos normalizados relevantes.

---

## Decisões que precisaram de interpretação (sem criar funcionalidade)

1. **Padronização estrutural**
   - Todos os PRDs foram reescritos na mesma macroestrutura: Objetivo, Conceito central, Regras obrigatórias, Fluxo, Edge cases, Proibições, Resultado esperado.

2. **Campo “participa da análise” em layout base**
   - Mantido como informativo (não funcional), coerente com textos originais.

3. **“Nova análise (opcional)”**
   - Não promovida a fluxo padrão do sistema por falta de detalhamento operacional consistente entre documentos.
   - Mantido o princípio de limpeza apenas por ação explícita quando referido.

4. **Tipos de não processamento**
   - Mantidos como distinção de processamento (`ignorado_sem_base`, `ignorado_sem_alteracao`, `erro_normalizacao`), com possibilidade de agregação visual na UI.

---

## Pontos que precisavam validação do usuário (agora decididos)

1. **Persistência de complementar sem base**
   - Decisão final: não persistir operacionalmente em `registros_complementares`, não entrar na conferência e apenas contabilizar em log/resumo como `ignorado_sem_base`.

2. **Escopo de atualização na Base**
   - Decisão final: `placa_normalizada` permanece campo relevante; mudança com mesma chave gera atualização e reprocessamento, mesmo sem mudança em campos analíticos.

3. **Critério de ambiguidade multi-layout**
   - Decisão final: múltiplos layouts válidos para mesma chave resultam sempre em `ambiguo` com `origem = NULL`; não existe priorização automática nem layout preferido.

4. **Métrica de importação exibida ao usuário**
   - Decisão final: UI principal pode exibir ignorados agregados, mas deve existir detalhamento consultável de `ignorado_sem_base`, `ignorado_sem_alteracao` e `erro_normalizacao`.

5. **“Nova análise” operacional**
   - Decisão final: fora do escopo operacional desta fase; manter apenas diretriz de ação explícita do usuário e deixar detalhamento técnico para PRD futuro específico.

---

## Resultado da revisão
- PRDs consolidados sem contradições internas explícitas.
- Regras críticas reunidas de forma uniforme.
- Edge cases críticos de importação, matching e conferência explicitados sem introdução de lógica nova.
- Pendências de decisão encerradas com diretrizes finais incorporadas.

---

## Decisões finais incorporadas

1. **Complementar sem Base**
   - Regra incorporada: sem persistência operacional em `registros_complementares`, sem entrada na conferência e contabilização no log/resumo como `ignorado_sem_base`.
   - PRDs impactados:
     - `PRD — Sistema de Conferência de Contratos (V6)`
     - `Mini PRD — Tela de Importação de Relatórios`
     - `Mini PRD — Esquema de Dados do Sistema`
     - `Mini PRD — Tela de Layouts Complementares`

2. **Atualização da Base quando mudar `placa_normalizada`**
   - Regra incorporada: `placa_normalizada` continua campo relevante para atualização e reprocessamento.
   - PRDs impactados:
     - `PRD — Sistema de Conferência de Contratos (V6)`
     - `Mini PRD — Tela de Importação de Relatórios`

3. **Ambiguidade entre múltiplos layouts complementares**
   - Regra incorporada: sempre `ambiguo`, `origem = NULL`, sem priorização automática e sem layout preferido.
   - PRDs impactados:
     - `PRD — Sistema de Conferência de Contratos (V6)`
     - `Mini PRD — Esquema de Dados do Sistema`
     - `Mini PRD — Tela de Conferência de Contratos`
     - `Mini PRD — Tela de Layouts Complementares`

4. **Exibição de ignorados na UI de importação**
   - Regra incorporada: agregação permitida na UI principal com detalhamento consultável obrigatório no processamento/log.
   - PRDs impactados:
     - `PRD — Sistema de Conferência de Contratos (V6)`
     - `Mini PRD — Tela de Importação de Relatórios`

5. **“Nova análise” / limpeza**
   - Regra incorporada: fora do escopo operacional desta fase; apenas ação explícita do usuário e dependência de PRD futuro para detalhamento.
   - PRDs impactados:
     - `PRD — Sistema de Conferência de Contratos (V6)`
     - `Mini PRD — Tela de Importação de Relatórios`

---

## Extração do PRD de Matching

- O novo PRD `PRD — Motor de Matching e Diagnóstico.md` foi criado para centralizar, em fonte única, a lógica de decisão do algoritmo de conferência e reduzir espalhamento de regras entre documentos.
- Foram consolidadas nele, sem alteração semântica:
  - ordem obrigatória de processamento (matching por chave antes de diagnóstico por `nota + placa`);
  - regras do matching principal;
  - regras do diagnóstico secundário e suas condições de execução;
  - regras de origem, ambiguidade (`ambiguo` com `origem = NULL`) e ausência de priorização;
  - tabela de decisão final de status;
  - gatilhos e escopo de reprocessamento por chaves afetadas, incluindo impacto de `placa_normalizada`.
- PRDs que passaram a referenciar explicitamente o novo documento:
  - `PRD — Sistema de Conferência de Contratos (V6)`
  - `Mini PRD — Tela de Importação de Relatórios`
  - `Mini PRD — Tela de Conferência de Contratos`
  - `Mini PRD — Esquema de Dados do Sistema`
  - `Mini PRD — Tela de Layouts Complementares`
- Confirmação: nenhuma regra nova foi criada; houve apenas extração e consolidação de regras já aprovadas nos PRDs existentes.
