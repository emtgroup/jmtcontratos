# 1. Resumo executivo

Foi realizada uma auditoria técnica do fluxo de importação da Base (GRL053), tomando os PRDs em `public/PRD` como fonte oficial de verdade.

**Conclusão principal:** no código atual deste repositório, **não há evidência de deleção automática da Base durante a importação**. A função de importação faz apenas `insert` e `update` em `registros_base`, sem `delete/truncate/replace` nesse fluxo.

O comportamento destrutivo descrito (6.000 linhas “sumirem” após importação de arquivo com 1 linha) **não foi localizado na persistência da Base neste código**. O que foi encontrado:

- existe limpeza destrutiva de Base/Conferência, mas somente por ação explícita via fluxo “Limpar dados importados”; 
- a tela de Conferência do frontend está em **modo mock** (não consulta banco);
- o resumo da importação retorna métricas da **carga processada na execução atual** (não total consolidado).

Portanto, a causa mais provável no estado atual do repositório é **camada de exibição/interpretação (resumo/query/tela)** e não deleção física dos 6.000 registros pela rotina `importar-base`.

---

# 2. PRDs lidos

Leitura integral dos seguintes documentos:

1. `public/PRD/PRD — Sistema de Conferência de Contratos (V6).md`
2. `public/PRD/Mini PRD — Tela de Importação de Relatórios.txt`
3. `public/PRD/Mini PRD — Esquema de Dados do Sistema.txt`
4. `public/PRD/Mini PRD — Tela de Conferência de Contratos.txt`
5. `public/PRD/Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
6. `public/PRD/Mini PRD — Tela de Layouts Complementares.txt`

Pontos normativos confirmados:

- importação da Base é incremental acumulativa e não destrutiva;
- ausência de chave em nova carga não remove registro antigo;
- idempotência por chave normalizada;
- 1 registro por `chave_normalizada` na Base;
- limpeza só por ação explícita do usuário;
- conferência deve refletir estado consolidado, não apenas última carga.

---

# 3. Arquivos analisados

## Backend/Edge
- `supabase/functions/importar-base/index.ts`
- `supabase/functions/limpar-dados-importados/index.ts`

## Frontend/Services
- `src/services/importacaoBaseService.ts`
- `src/pages/Importacao.tsx`
- `src/pages/Conferencia.tsx`
- `src/types/importacao.ts`
- `src/data/mock.ts`

## Banco/Migrações
- `supabase/migrations/20260415194155_ebdbd5b0-0236-40bf-80ab-fa0d2ca5b432.sql`
- `supabase/migrations/20260415194210_82a9d435-46b3-45ed-b52d-3629b02c12b8.sql`
- `supabase/migrations/20260417183923_386f7de6-dd7b-44ad-af2a-1d07c0f38650.sql`
- `supabase/migrations/20260416134210_c45e64cf-6d22-4c1f-bcdf-d6295cda9cef.sql`
- `supabase/migrations/20260420110000_add_registros_complementares.sql`

---

# 4. Fluxo real encontrado no código

## 4.1 Importação Base (cliente)

1. Frontend valida layout ativo e lê planilha (`parseExcelFile`);
2. envia payload para edge function `importar-base`;
3. recebe resumo com `inseridos/atualizados/ignorados/...`;
4. exibe resumo da execução.

## 4.2 Importação Base (edge `importar-base`)

1. cria registro em `importacoes` com status `em_andamento`;
2. aplica lock via `import_lock`;
3. normaliza contrato/nota/placa;
4. descarta linhas inválidas (chave incompleta) e duplicatas internas do arquivo;
5. busca existentes em `registros_base` por `chave_normalizada`;
6. classifica por chave:
   - inexistente => inserir
   - existente com mudança estrutural => atualizar
   - existente sem mudança => ignorar
7. executa `insert` em lote e `update` por id;
8. atualiza `conferencia` por `upsert` **apenas nas chaves afetadas**;
9. finaliza `importacoes` como `concluida` e libera lock.

**Não há `delete/truncate/replace/reset/clear` dentro do fluxo de importação base.**

## 4.3 Limpeza destrutiva existente

A deleção existe na função de limpeza (`limpar-dados-importados`) e no fallback client-side de limpeza, ambos acionados por ação explícita na tela de Importação:

- `delete` em `registros_base` (escopo base ou tudo)
- `delete` em `registros_complementares` (escopo complementar ou tudo)
- `delete` em `conferencia` (sempre)

Esse caminho **é destrutivo**, porém explicitamente acionado pelo usuário.

## 4.4 Conferência/listagem

No estado atual do repositório:

- `src/pages/Conferencia.tsx` usa `conferenciaRecords` de `src/data/mock.ts`;
- não há query real para tabela `conferencia` nessa tela.

Logo, a “quantidade exibida” em Conferência neste código não representa estado do banco.

---

# 5. Comportamento esperado pelo PRD

Pelo PRD, para Base GRL053:

- persistência incremental acumulativa;
- sem remoção por ausência no arquivo novo;
- idempotência para reimportação igual;
- base consolidada com 1 registro por chave;
- conferência deve refletir estado consolidado geral.

---

# 6. Divergências encontradas entre código e PRD

## 6.1 Divergência crítica de produto (alta)

A tela de Conferência está mockada e não lê estado consolidado do banco. Isso diverge do PRD, que exige exibição do estado materializado atual.

## 6.2 Divergência de semântica do resumo (média)

O resumo retornado pela importação representa apenas chaves processadas no arquivo atual, não total consolidado da base/conferência. Isso pode induzir leitura incorreta de “substituição total” quando a carga é pequena.

## 6.3 Persistência Base vs PRD (aderente)

A persistência da Base no fluxo `importar-base` está alinhada ao modelo incremental e não destrutivo (insert/update/ignore).

---

# 7. Causa raiz mais provável

## Probabilidade 1 — **Alta**: problema de exibição/interpretação (não persistência)

A evidência do repositório aponta que o comportamento “ficou só 1 linha” pode ocorrer por camada de visualização/resumo, não por remoção física na importação base.

## Probabilidade 2 — **Média**: acionamento involuntário do fluxo de limpeza explícita

Existe rota funcional destrutiva que apaga base/conferência. Não há indício de chamada automática no fluxo de importação, mas uma execução indevida desse fluxo causaria exatamente sumiço em massa.

## Probabilidade 3 — **Baixa no código atual**: sincronização total no backend de importação

Não foi encontrado algoritmo de snapshot total nem remoção de “não presentes” na edge `importar-base`.

---

# 8. Evidências técnicas objetivas

1. `importar-base` usa `insert`/`update` por chave e não contém `delete` em `registros_base`.
2. Há `UNIQUE` em `registros_base.chave_normalizada`, reforçando idempotência e 1 registro por chave.
3. Limpeza destrutiva existe apenas na função dedicada `limpar-dados-importados` e no fallback equivalente no client.
4. Tela de Conferência está mockada (dados fixos de `src/data/mock.ts`), sem consulta ao backend.
5. Resumo da importação é calculado por chaves processadas na execução atual.

---

# 9. Riscos de uma correção mal feita

- introduzir `delete` por “diferença de snapshot” e violar regra incremental do PRD;
- confundir “resumo da carga” com “estado consolidado”, levando a decisões erradas de negócio;
- alterar persistência que hoje já está incremental e criar regressão de idempotência;
- mascarar causa real na camada de exibição e manter problema operacional.

---

# 10. Correção mínima recomendada

Sem reescrita ampla, mantendo estrutura atual:

1. **Diagnóstico confirmatório obrigatório (antes de codar):**
   - validar no banco se, após cenário 6000→reimporta→1, o `count(*)` de `registros_base` permanece ~6000+;
   - validar se houve chamada à função de limpeza no período.

2. **Ajuste mínimo de produto (se confirmar problema de exibição):**
   - separar no UI: “Resumo da carga atual” vs “Totais consolidados atuais”;
   - incluir fonte explícita dos números exibidos para evitar interpretação de snapshot.

3. **Ajuste mínimo de conferência (quando sair de mock):**
   - garantir query da conferência sem filtro por `ultima_importacao_id/importacao_id` da última carga;
   - usar estado consolidado materializado.

4. **Hardening de segurança operacional:**
   - manter limpeza apenas explícita e auditar gatilho (telemetria/log) para rastrear acionamento indevido.

---

# 11. Lista exata de arquivos que precisariam ser alterados

> Observação: nesta etapa **não foi aplicada correção funcional**, apenas análise. A lista abaixo é de alteração mínima futura, condicionada à validação de banco.

1. `src/pages/Importacao.tsx` (texto/semântica de resumo e possível exibição de totais consolidados)
2. `supabase/functions/importar-base/index.ts` (apenas se necessário ajustar payload do resumo para trazer totais consolidados, sem tocar regra incremental)
3. `src/pages/Conferencia.tsx` (troca de mock por leitura consolidada real, quando essa etapa for ativada)
4. `src/data/mock.ts` (eventual descontinuação da fonte mock na conferência)
5. (opcional) `supabase/functions/limpar-dados-importados/index.ts` (logs/auditoria de execução)

---

# 12. Dúvidas remanescentes

1. O comportamento observado (ficar 1 linha) ocorreu neste exato código/deploy ou em ambiente com versão diferente?
2. Há logs de execução da função `limpar-dados-importados` no intervalo do teste?
3. Existe algum painel/listagem de base fora deste repositório que filtre por `ultima_importacao_id` da última carga?
4. O ambiente de teste usa a tela de Conferência mockada atual ou uma versão já integrada ao banco?

---

## Respostas objetivas às 7 perguntas solicitadas

1. **As 6.000 linhas foram realmente deletadas ou só sumiram da visualização?**
   - Neste código, não há evidência de deleção automática na importação Base; indício maior de problema de visualização/interpretação.

2. **Em qual ponto ocorre comportamento destrutivo?**
   - O único ponto destrutivo identificado é o fluxo explícito de limpeza (`limpar-dados-importados`).

3. **Problema está em persistência, reprocessamento, conferência, resumo ou query?**
   - Maior probabilidade: conferência/resumo/query/exibição; baixa probabilidade de persistência no fluxo `importar-base`.

4. **Existe lógica de sincronização total contrariando PRD?**
   - Não foi encontrada na rotina de importação Base analisada.

5. **Existe limpeza automática sem ação explícita?**
   - Não encontrada. Limpeza observada é por ação explícita (botão/dialog/escopo).

6. **Problema é backend, frontend ou ambos?**
   - Mais provável frontend/camada de leitura-exibição; backend destrutivo só na limpeza explícita.

7. **Correção mínima e segura para alinhar ao PRD?**
   - Validar contagem real no banco + separar claramente resumo da carga vs estado consolidado + garantir consultas de conferência consolidadas sem filtro de última importação.
