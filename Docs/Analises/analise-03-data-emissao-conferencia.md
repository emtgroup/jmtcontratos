# Análise 03 — Ausência de **Data emissão** na tela `/conferencia`

## 1) Resumo executivo
A coluna **Data emissão** está chegando como `—` na `/conferencia` porque a tela lê exclusivamente `vw_conferencia_tela.data_referencia`, e esse campo só existe em `registros_base` desde a migration de **22/04/2026**. Não há rotina de backfill para registros importados antes dessa migration; portanto, esses registros antigos continuam com `data_referencia = NULL` e a UI apenas exibe esse vazio corretamente.

Além disso, o importador atual só preenche `data_referencia` quando o layout base tiver tipo lógico reconhecido como `data_da_nota`/`data`. Se esse mapeamento estiver ausente ou incorreto, o valor também permanece nulo.

**Conclusão objetiva:** o principal ponto de perda está na **persistência histórica (sem backfill)** e, secundariamente, na dependência estrita do mapeamento do layout para a coluna de data.

---

## 2) Evidências encontradas

### 2.1. PRD: data da base deve aparecer na conferência
- PRD da tela de conferência define coluna fixa de **Data da base** na grid.  
- Mini PRD da conferência define que a data principal da tela deve ser a data da Base.

### 2.2. Frontend da `/conferencia`
- A tela consome `vw_conferencia_tela` e mapeia `row.data_referencia -> r.dataBase`.  
- A célula da tabela exibe `r.dataBase ?? "—"` (sem cálculo/fallback).  
- Portanto, se vier `NULL` do backend, a UI mostrará `—` por regra.

### 2.3. View/materialização consumida pela tela
- A view `vw_conferencia_tela` expõe `rb.data_referencia` diretamente.  
- Não há fallback da view para buscar data em `dados_originais`.

### 2.4. Banco/migrations
- Schema inicial de `registros_base` não tinha coluna materializada de data.  
- A coluna `data_referencia` foi adicionada depois, em migration de **22/04/2026** (`ADD COLUMN IF NOT EXISTS data_referencia TEXT`).  
- Essa migration não inclui backfill de registros já existentes.

### 2.5. Importação (parser + edge function)
- Parser no frontend identifica a coluna de data apenas por tipos lógicos `data_da_nota` ou `data`.  
- O parser envia `linha.data` como string (sem parse robusto de Excel serial/date).  
- A edge function `importar-base` persiste `data_referencia: p.data` em insert/update.
- Regras de update atualizam contexto informativo (incluindo data), mas só para registros processados na importação atual.

### 2.6. Divergência de implementação relevante para diagnóstico
- A tipagem gerada do Supabase (`src/integrations/supabase/types.ts`) ainda não reflete campos adicionados depois (`registros_base.data_referencia`, `conferencia.motivo_status`). Embora a página de conferência use a view via cast e funcione, isso é sinal de drift de contrato e dificulta auditoria.

### 2.7. Evidência operacional indisponível no ambiente atual
- Tentei consultar a instância remota Supabase para amostrar registros reais com `data_referencia IS NULL`, mas houve bloqueio de rede (`CONNECT tunnel failed, response 403`).
- Portanto, a validação de amostra real de dados ficou limitada ao código e migrations neste ambiente.

---

## 3) Caminho real do dado (layout → importação → persistência → consulta → frontend)

1. **Layout base (GRL053)**
   - Usuário mapeia coluna com tipo lógico (ex.: `Data da nota`).
   - O sistema normaliza tipo para `data_da_nota`.

2. **Importação (cliente)**
   - `parseExcelFile()` resolve índices por tipo.
   - Para data, usa primeiro tipo existente entre `data_da_nota` e `data`.
   - Se nenhum desses tipos existir no layout, `linha.data` fica `undefined`.

3. **Importação (backend edge function `importar-base`)**
   - Normaliza contrato/nota/placa.
   - Converte `linha.data` para `data: string | null` apenas com `trim`.
   - Persiste em `registros_base.data_referencia` nos inserts/updates.

4. **Consulta de conferência**
   - `vw_conferencia_tela` faz join `conferencia` + `registros_base` e expõe `rb.data_referencia`.

5. **Frontend `/conferencia`**
   - `dataBase = row.data_referencia ?? null`.
   - Exibição: `dataBase ?? "—"`.

---

## 4) Ponto exato da falha

### Falha principal (confirmada por código/migrations)
**Persistência histórica sem backfill**: registros importados antes de 22/04/2026 não foram retroalimentados para a nova coluna `registros_base.data_referencia`. Como a tela lê essa coluna materializada, esses registros aparecem com `—`.

### Falha secundária (condicional)
Se o layout base ativo não tiver tipo lógico de data reconhecido (`data_da_nota` ou `data`), o parser não preenche `linha.data` e a importação persistirá `NULL` em `data_referencia`, mesmo em novas cargas.

### Não é a causa raiz no frontend
O frontend está aderente ao PRD: ele não inventa data e apenas mostra `—` quando o backend retorna nulo.

---

## 5) Impacto
- Operação de conferência perde contexto temporal em parte dos registros, prejudicando investigação (PRD de conferência).
- Pode haver percepção de inconsistência (“campo existe no GRL053 mas some na conferência”).
- Risco de diagnóstico manual incorreto por ausência de data em itens que deveriam exibir.
- Drift de tipos Supabase aumenta risco de regressão silenciosa em evoluções.

---

## 6) Correção mínima recomendada (sem implementar nesta tarefa)

1. **Backfill único e auditável** de `registros_base.data_referencia` para registros legados:
   - preencher a partir de `dados_originais` usando a coluna mapeada do layout base ativo para tipo `data_da_nota`/`data`.
   - registrar migration/script reversível e com critério explícito.

2. **Checklist operacional pós-backfill**:
   - validar contagem de `data_referencia IS NULL` antes/depois;
   - validar amostra na `vw_conferencia_tela` para casos que hoje exibem `—`.

3. **Hardening opcional de baixo risco**:
   - logar alerta na importação quando o layout base não tiver tipo de data mapeado;
   - atualizar tipos gerados do Supabase para eliminar drift de contrato.

---

## 7) Dúvidas ou inconsistências
1. **Path documental solicitado vs path real do repositório**: instrução pede `/docs/Analises`, mas o projeto usa `Docs/Analises` (maiúsculo). Esta análise foi salva no padrão real existente do repositório.
2. **Validação com amostra real do banco** não foi possível aqui por bloqueio de rede externa para a URL do Supabase.
3. **Formato da data**: hoje a importação não converte serial Excel para data ISO; isso não explica o `—`, mas pode gerar formato heterogêneo nos registros não nulos.

---

## Checklist obrigatório da análise
- [x] Leu os PRDs relevantes em `/Docs/PRD`
- [x] Validou o mapeamento da data no layout base GRL053
- [x] Validou o parser/importador do relatório base
- [x] Validou persistência em `registros_base`
- [x] Validou presença/ausência real do dado no banco (**parcial: por código/migration; sem amostra remota por bloqueio de rede**)
- [x] Validou query/backend da tela `/conferencia`
- [x] Validou consumo do campo no frontend
- [x] Identificou o ponto exato da falha
- [x] Gerou arquivo Markdown em `/Docs/Analises`

---

## Referências técnicas inspecionadas
- `Docs/PRD/01 - PRD — Sistema de Conferência de Contratos (V6).md`
- `Docs/PRD/03 - PRD — Tela de Conferência.md`
- `Docs/PRD/04 - Mini PRD — Tela de Importação de Relatórios.txt`
- `Docs/PRD/05 - Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
- `Docs/PRD/08 - Mini PRD — Esquema de Dados do Sistema.txt`
- `Docs/PRD/09 - Mini PRD — Tela de Conferência de Contratos.txt`
- `src/services/importacaoBaseService.ts`
- `supabase/functions/importar-base/index.ts`
- `supabase/migrations/20260415194155_ebdbd5b0-0236-40bf-80ab-fa0d2ca5b432.sql`
- `supabase/migrations/20260422150000_enrich_conferencia_contexto_tela.sql`
- `supabase/migrations/20260423110000_conferencia_labels_contexto_base.sql`
- `src/pages/Conferencia.tsx`
- `src/integrations/supabase/types.ts`
