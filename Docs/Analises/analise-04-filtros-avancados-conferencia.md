# Análise 04 — Viabilidade de filtros avançados por **Tipo** na `/conferencia`

## 1) Diagnóstico atual

A tela `/conferencia` já opera com paginação server-side, filtro por status e busca textual, consumindo a view `vw_conferencia_tela` como dataset único. O frontend aplica filtros diretamente na query da view e calcula contadores por consultas `count` separadas no mesmo universo de busca/status.  

Pontos confirmados no estado atual:
- Fonte da listagem: `vw_conferencia_tela`.  
- Filtros atuais efetivos: `status` + busca em `contrato_vinculado`, `nota_fiscal`, `clifor`.  
- Paginação: `.range(inicio, fim)` + `count: "exact"`.  
- Contadores: 5 queries `count` (todos + por status) mantendo o mesmo filtro de busca.  

Conclusão de viabilidade: **é viável evoluir para filtros por Tipo sem trocar arquitetura**, desde que o backend continue resolvendo `Tipo -> campo real` e exponha esses campos na view/query server-side.

---

## 2) Como os dados estão estruturados hoje

### 2.1 Estruturados (colunas físicas)
Em `registros_base`, os principais campos já materializados para conferência são:
- `contrato_vinculado`
- `nota_fiscal`
- `placa_normalizada`
- `data_referencia` (TEXT)
- `dados_originais` (JSONB)

Em `conferencia`:
- `status`
- `motivo_status`
- `origem`

### 2.2 Campos vindos de JSON (`dados_originais`)
A view `vw_conferencia_tela` já resolve dinamicamente alguns campos analíticos via layout ativo + `dados_originais`:
- `contrato_interno` (via tipo lógico `contrato_interno`)
- `clifor` (via tipo lógico `clifor`)

### 2.3 Implicação
Hoje o sistema já tem **modelo híbrido**:
- parte dos filtros podem usar coluna física direta;
- parte depende de extração por mapeamento de tipo em `layouts_base_colunas`.

Esse modelo é compatível com a diretriz de filtrar por **Tipo**, não por nome Excel.

---

## 3) Quais Tipos são filtráveis hoje

## 3.1 Disponíveis diretamente na query da `/conferencia`
Com base em `src/pages/Conferencia.tsx` + `vw_conferencia_tela`, os campos já presentes no dataset da tela são:
- `status` (não é tipo de layout, mas filtro operacional obrigatório)
- `origem` (operacional)
- `contrato_vinculado` (Tipo: Contrato vinculado)
- `nota_fiscal` (Tipo: Nota fiscal)
- `clifor` (Tipo: Clifor)
- `contrato_interno` (Tipo: Contrato interno)
- `placa` (Tipo: Placa)
- `data_referencia` (Tipo: Data da nota/Data)
- `motivo_status` (operacional)

## 3.2 Especificamente sobre **Nome cooperativa**
**Não está disponível hoje na `vw_conferencia_tela`**. Mesmo existindo como tipo configurável no layout (`Nome cooperativa`), não há extração desse tipo na view atual. Portanto, **não está filtrável server-side no estado atual**.

---

## 4) Limitações técnicas encontradas

1. **Cobertura parcial de tipos na view**: só `contrato_interno` e `clifor` são extraídos dinamicamente do JSON por tipo; outros tipos analíticos (produto, nome cooperativa, chave de acesso etc.) não entram na view.  
2. **`data_referencia` como TEXT**: range de data pode ficar inconsistente se coexistirem formatos não-ISO (apesar da sanitização parcial na importação).  
3. **Contadores com múltiplas queries**: com muitos filtros avançados, manter coerência exige repetir exatamente os mesmos predicados em todas as contagens.  
4. **Drift de tipagem gerada**: `src/integrations/supabase/types.ts` ainda mostra `vw_conferencia_tela` reduzida; isso aumenta risco de erro de contrato ao evoluir filtros.  
5. **Performance futura**: filtros por extração JSON sem materialização/índice podem degradar em volume alto.

---

## 5) Estratégia para mapear Tipo → campo real

## 5.1 Regra alvo (alinhada ao pedido)
O filtro deve receber `tipo_logico` (ex.: `nome_cooperativa`) e `valor`, e o backend resolve internamente o campo real.

## 5.2 Mapeamento recomendado
Resolver sempre a partir do layout base ativo (`layouts_base_colunas`):
1. Normalizar tipo: `lower(replace(trim(tipo_coluna), ' ', '_'))`.
2. Buscar `nome_coluna_excel` correspondente ao tipo.
3. Aplicar filtro no campo correto:
   - se tipo materializado: coluna física (`rb.campo`).
   - se tipo não materializado: `rb.dados_originais ->> nome_coluna_excel`.

## 5.3 Estado atual do mapeamento
- **Já existe parcialmente** para:
  - importação (tipo -> índice/coluna no parser),
  - view da conferência (`contrato_interno`, `clifor`),
  - backfill de data (`data_da_nota`/`data`).
- **Ainda não existe mapeamento genérico reutilizável** para filtros arbitrários por tipo na `/conferencia`.

---

## 6) Filtros recomendados (MVP)

Implementáveis com menor risco e aderência ao PRD (sem recalcular matching no frontend):

1. **Status** (já existe).  
2. **Origem** (já está no dataset; incluir no UI).  
3. **Nome cooperativa** (prioritário do negócio) via resolução por tipo no backend + extração de `dados_originais`.  
4. **Clifor** (já disponível na view).  
5. **Nota fiscal** (já disponível).  
6. **Contrato vinculado** (já disponível).  
7. **Placa** (já disponível como `placa`).

Observação: todos podem manter paginação server-side e contadores coerentes se aplicados no mesmo universo de consulta/contagem.

---

## 7) Filtros futuros

Depois do MVP, com mesma abordagem de Tipo:
- **Produto**
- **Contrato interno** (já disponível na view, apenas expor no UI)
- **Chave de acesso (preenchido/vazio)**
- **Data da nota por intervalo** (com padronização/cast robusto de data)
- Outros tipos analíticos cadastráveis no layout base

---

## 8) Alterações mínimas necessárias

Sem mudança estrutural ampla, o caminho mínimo é:

1. **Backend/query**: ampliar a fonte da `/conferencia` para aceitar filtros por tipo lógico (idealmente em RPC/view enriquecida), sem depender do nome Excel na API pública.  
2. **Resolver tipo internamente** usando `layouts_base_colunas` ativo.  
3. **Aplicar predicados no backend** tanto na listagem quanto nos contadores.  
4. **Frontend**: enviar filtros por `tipo` + `valor` + intervalo (quando aplicável), sem regras semânticas locais.  

### Classificação por esforço
- **Sem ajuste estrutural**: status, origem, contrato vinculado, nota fiscal, clifor, placa, contrato interno.  
- **Ajuste mínimo backend**: nome cooperativa, produto, chave de acesso (pois hoje não estão projetados na view da conferência).  
- **Ajuste mínimo + cuidado de formato**: data da nota (intervalo), devido à coluna textual.

---

## 9) Impacto em performance

- Curto prazo (baixo volume): viável manter abordagem atual com `count exact` e predicados replicados.  
- Médio prazo: filtros baseados em `dados_originais ->> campo` podem custar caro sem indexação específica.  
- Mitigações progressivas (sem quebrar arquitetura):
  - priorizar materialização dos tipos mais usados (ex.: nome cooperativa, produto);
  - considerar índices funcionais para campos de filtro recorrente;
  - centralizar listagem+contagens numa única função SQL para evitar divergência de predicados.

---

## 10) Necessidade de ajuste em PRD

A base de PRD já permite a evolução (campos analíticos informativos, sem impacto no matching).  
Ajuste recomendado (documental):
- explicitar na PRD da tela `/conferencia` que **filtros avançados são orientados a Tipo lógico** e resolvidos no backend;
- explicitar lista inicial de tipos suportados no MVP e comportamento de contadores sob filtros múltiplos;
- explicitar regra para intervalo de data quando dado vier em formato textual não padronizado.

---

## 11) Perguntas pendentes

1. O tipo canônico para cooperativa será **`nome_cooperativa`** (normalização de `Nome cooperativa`) em todos os pontos?  
2. Para data intervalo: aceitar apenas datas parseáveis/ISO ou manter fallback textual com comportamento “não filtrável por range”?  
3. A UX de filtros avançados permitirá múltiplos filtros simultâneos por Tipo (AND) já no MVP?  
4. Deseja priorizar desempenho com materialização de `nome_cooperativa` já no MVP ou começar com leitura de JSON?  
5. Os contadores no topo devem refletir:
   - apenas busca + filtros avançados (recomendado), ou
   - busca + filtros avançados + status ativo (modelo atual separa status em badges)?

---

## Respostas objetivas ao objetivo da análise

1. **Tipos/campos hoje na view/query da `/conferencia`**: contrato vinculado, nota fiscal, clifor, contrato interno, placa, data da base (além de status/origem/motivo).  
2. **"Nome cooperativa" disponível server-side?**: **não**, não está projetado na view atual.  
3. **Onde estão os dados analíticos?**: parte em colunas estruturadas (`contrato_vinculado`, `nota_fiscal`, `placa_normalizada`, `data_referencia`), parte em `registros_base.dados_originais` (JSONB).  
4. **Mapeamento Tipo -> campo real**: via `layouts_base_colunas` ativo (tipo normalizado -> `nome_coluna_excel`) + leitura de coluna física ou JSON.  
5. **Mapeamento já existe?**: parcialmente; precisa de camada genérica para filtros avançados.  
6. **Filtros no backend com paginação/contadores corretos?**: **sim**, desde que os mesmos predicados sejam aplicados em listagem e contagem.  
7. **Filtros sem alteração estrutural**: status, origem, contrato vinculado, nota fiscal, clifor, placa, contrato interno.  
8. **Filtros com ajuste mínimo backend**: nome cooperativa, produto, chave de acesso; data por intervalo exige cuidado adicional de formato.

---

## Referências inspecionadas

- `Docs/PRD/01 - PRD — Sistema de Conferência de Contratos (V6).md`
- `Docs/PRD/03 - PRD — Tela de Conferência.md`
- `Docs/PRD/09 - Mini PRD — Tela de Conferência de Contratos.txt`
- `Docs/PRD/05 - Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
- `Docs/PRD/08 - Mini PRD — Esquema de Dados do Sistema.txt`
- `src/pages/Conferencia.tsx`
- `src/pages/Configuracoes.tsx`
- `src/services/importacaoBaseService.ts`
- `src/services/layoutBaseService.ts`
- `supabase/functions/importar-base/index.ts`
- `supabase/migrations/20260420130000_add_vw_conferencia_tela.sql`
- `supabase/migrations/20260422150000_enrich_conferencia_contexto_tela.sql`
- `supabase/migrations/20260423110000_conferencia_labels_contexto_base.sql`
- `supabase/migrations/20260423170000_backfill_registros_base_data_referencia.sql`
- `supabase/migrations/20260415194155_ebdbd5b0-0236-40bf-80ab-fa0d2ca5b432.sql`
- `supabase/migrations/20260416134210_c45e64cf-6d22-4c1f-bcdf-d6295cda9cef.sql`
