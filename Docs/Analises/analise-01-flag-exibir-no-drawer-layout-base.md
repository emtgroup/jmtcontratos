# Análise de viabilidade — flag **"Exibir no drawer"** no layout base (GRL053)

## 1) Resumo executivo

## Viabilidade geral
**Viável com baixo risco**, desde que o escopo permaneça estritamente visual (UI de conferência) e não altere o motor de processamento. A proposta é coerente com o desenho atual porque:
- o sistema já separa claramente **configuração visual** (layout/apelidos) de **regra de negócio** (matching/status/chave);
- a grid da `/conferencia` já é fixa por PRD e implementação;
- o drawer já é investigativo/read-only e hoje está limitado à projeção da `vw_conferencia_tela`.

## Benefícios esperados
- Controle explícito e auditável de quais campos analíticos da Base aparecem no drawer.
- Redução de ruído visual no detalhe sem mexer na tabela principal.
- Continuidade do padrão existente de metadados por coluna em `layouts_base_colunas`.

## Principais riscos
- **Risco de escopo/expectativa**: usuário interpretar a flag como “personalização da grid principal”.
- **Risco técnico**: tentar resolver com “view dinâmica” e aumentar complexidade SQL/typing desnecessariamente.
- **Risco de UX**: ausência de texto de ajuda pode gerar confusão com o campo atual `analise`.

---

## 2) Diagnóstico técnico

## Estado atual relevante
- `layouts_base_colunas` já concentra metadados de coluna (`nome_coluna_excel`, `apelido`, `tipo_coluna`, `analise`, `ordem`).
- A tela de Configurações (GRL053) edita exatamente esses metadados, com checkbox para `analise`.
- A tela `/conferencia` consome a `vw_conferencia_tela` e mantém grid fixa.
- O drawer mostra um conjunto estático de campos (status, motivo, contrato vinculado/interno, nota, clifor, placa, data, chave), sem leitura genérica de extras da Base.

## Onde a flag entraria (menor caminho)
**Armazenamento recomendado:** `public.layouts_base_colunas`.

**Nome recomendado:** `exibir_no_drawer`.

**Tipo recomendado:** `boolean NOT NULL DEFAULT false`.

Justificativa:
- mantém a semântica “configuração por coluna” no mesmo agregado já usado pelo layout base;
- evita nova tabela/estrutura;
- permite rollout incremental simples (migração + tipagem + UI + leitura no drawer), sem tocar no motor de conferência.

## Camadas afetadas futuramente (quando implementar)
1. **Banco (mínimo):** migration adicionando coluna booleana em `layouts_base_colunas`.
2. **Tipagens Supabase:** `src/integrations/supabase/types.ts`.
3. **Serviço de layout base:** leitura/escrita do novo campo em `src/services/layoutBaseService.ts`.
4. **Tela Configurações:** nova coluna checkbox em `src/pages/Configuracoes.tsx` com ajuda textual.
5. **Tela Conferência (drawer):** leitura dos campos marcados e renderização adicional apenas no drawer em `src/pages/Conferencia.tsx`.

## Ponto crítico da pipeline de leitura
Há duas opções:
- **A) enriquecer `vw_conferencia_tela` com N colunas conhecidas** → escala mal quando campos extras mudam.
- **B) manter `vw_conferencia_tela` estável para grid + contexto mínimo e carregar extras do drawer por leitura de `dados_originais` com mapeamento de layout**.

**Recomendação mínima e segura:** **B**.
- preserva a view atual para listagem/KPIs/paginação;
- evita “view dinâmica” e alteração da semântica da grid;
- concentra dinamismo somente no drawer (escopo correto).

---

## 3) Validação contra PRDs

## Coerência com PRDs (aderente)
A flag proposta é aderente **se for somente visual**:
- PRDs reforçam que a grid é fixa e não dinâmica por layout.
- PRDs reforçam que frontend não decide matching/status.
- PRDs reforçam que campos analíticos enriquecem investigação sem alterar decisão.
- PRD do layout base já reconhece metadados visuais por coluna e separação de regra de negócio.

## O que precisa permanecer intocado
- Chave global `contrato_vinculado + nota_fiscal`.
- Motor de matching/diagnóstico.
- Persistência operacional base/complementar.
- Regras de status/origem.
- Grid principal da conferência (colunas fixas).

## Necessidade de ajuste em PRD
**Sim, ajuste pequeno (não estrutural)** para remover ambiguidade sobre “como selecionar campos extras no drawer”.

### Sugestão objetiva de complemento
1. **`05 - Mini PRD — Tela de Layout do Relatório Base (GRL053)`**
   - Incluir novo metadado opcional por coluna: `exibir_no_drawer` (boolean).
   - Explicitar: “campo exclusivamente visual para o drawer da conferência”.

2. **`03 - PRD — Tela de Conferência`** e/ou **`09 - Mini PRD — Tela de Conferência de Contratos`**
   - Incluir regra: “drawer exibe conjunto fixo mínimo + campos analíticos da Base marcados com `exibir_no_drawer`”.
   - Explicitar: “não altera grid principal, matching, status, persistência ou importação”.

---

## 4) Limite de escopo da flag (regra proposta)

A flag `exibir_no_drawer` deve controlar **apenas**:
- visibilidade de campos analíticos da Base no drawer da `/conferencia`.

A flag **não** deve controlar:
- matching;
- chave;
- persistência de Base;
- status/motivo/origem;
- grid principal;
- importação complementar;
- regras do backend/motor de conferência.

---

## 5) Recomendação funcional de uso

## Regra de exibição recomendada
1. Drawer mantém **bloco mínimo fixo** (status, motivo, contrato vinculado, contrato interno, nota fiscal, clifor, placa, data, chave técnica).
2. Abaixo disso, exibir bloco **“Campos adicionais da Base”** com apenas colunas marcadas `exibir_no_drawer=true`.
3. Campos estruturais obrigatórios continuam no bloco fixo, **independentes da flag**.
4. A flag passa a valer principalmente para campos analíticos/contextuais.

## UX na tela de Configurações
- Nova coluna “Exibir no drawer” ao lado de “Análise”, com checkbox simples.
- Tooltip curta e explícita: “Controla apenas o drawer da /conferencia; não altera grid, matching ou status.”
- Não é obrigatório bloquear tecnicamente tipos estruturais; porém recomenda-se orientação textual de uso para evitar marcações redundantes.

---

## 6) Impacto na pipeline da `/conferencia`

## Sobre `vw_conferencia_tela`
**Não é recomendável torná-la dinâmica por flag.**

Motivo:
- a view hoje já suporta a grid fixa e alguns contextos base;
- dinamicidade na view para N campos aumenta custo de manutenção e tipagem;
- risco de acoplamento excessivo entre configuração e consulta principal.

## Abordagem mínima
- Manter listagem/KPI/filtro paginados na `vw_conferencia_tela` (como está).
- No evento de abrir drawer, carregar metadados de colunas da Base (`tipo_coluna`, `apelido`, `nome_coluna_excel`, `exibir_no_drawer`) e ler valores adicionais a partir de `registros_base.dados_originais` da chave selecionada.
- Renderizar apenas pares rótulo/valor dos campos marcados.

Essa abordagem mantém o desenho atual “frontend não decide status”; ele apenas lê contexto adicional.

---

## 7) Campos candidatos imediatos

Os seguintes campos são bons candidatos iniciais para `exibir_no_drawer`:
- **data de emissão / data da nota**: alto valor para investigação temporal.
- **chave de acesso**: útil para rastreio documental/NF-e.
- **observação NF**: contexto humano para divergências operacionais.
- **item/produto**: ajuda a identificar discrepâncias sem mexer em status.

Todos permanecem:
- contexto analítico;
- fora da chave global;
- fora do matching/status.

---

## 8) Riscos e mitigação

## Riscos de escopo
- Evoluir para “configuração dinâmica da grid” por interpretação equivocada.

**Mitigação:** tooltip + texto de ajuda + PRD explícito + naming claro (`exibir_no_drawer`).

## Riscos de UX
- Confusão entre `analise` e `exibir_no_drawer`.

**Mitigação:** descrever cada um com propósito distinto na UI e documentação.

## Riscos de arquitetura
- Pressão para ampliar `vw_conferencia_tela` dinamicamente.

**Mitigação:** preservar view estável e limitar dinamismo ao drawer.

---

## 9) Recomendação mínima (go/no-go)

## Decisão
**Go (recomendado implementar em etapa futura)** com escopo estrito e incremental.

## Forma de implementação futura (menor impacto)
1. Migration: adicionar `layouts_base_colunas.exibir_no_drawer boolean default false not null`.
2. Ajustar tipos + service + tela de configurações.
3. Ajustar drawer para incluir bloco de extras marcados, lendo `dados_originais` por chave.
4. Não alterar motor, status, matching, chave, grid principal.

---

## 10) Dúvidas em aberto (para fechamento antes de implementação)
1. O bloco fixo do drawer deve continuar exibindo `clifor` e `data` mesmo que desmarcados? (recomendação desta análise: **sim**, por previsibilidade operacional).
2. Campos estruturais devem poder ser marcados livremente ou ficar apenas implícitos no bloco fixo? (recomendação: manter livre, mas sem efeito prático adicional no bloco mínimo).
3. Quando campo marcado estiver vazio no `dados_originais`, exibir “—” ou ocultar linha? (recomendação: exibir com “—” para consistência visual/auditável).

---

## 11) Arquivos investigados

### PRDs
- `Docs/PRD/01 - PRD — Sistema de Conferência de Contratos (V6).md`
- `Docs/PRD/03 - PRD — Tela de Conferência.md`
- `Docs/PRD/05 - Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
- `Docs/PRD/08 - Mini PRD — Esquema de Dados do Sistema.txt`
- `Docs/PRD/09 - Mini PRD — Tela de Conferência de Contratos.txt`

### Frontend/serviços
- `src/pages/Configuracoes.tsx`
- `src/pages/Conferencia.tsx`
- `src/services/layoutBaseService.ts`

### Banco/tipagens
- `supabase/migrations/20260416134210_c45e64cf-6d22-4c1f-bcdf-d6295cda9cef.sql`
- `supabase/migrations/20260422150000_enrich_conferencia_contexto_tela.sql`
- `supabase/migrations/20260423110000_conferencia_labels_contexto_base.sql`
- `src/integrations/supabase/types.ts`
