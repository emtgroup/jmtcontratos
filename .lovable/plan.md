

# Plano revisado: Importação Complementar com matching multi-layout correto

## Ajustes de aderência ao PRD (vs. plano anterior)

**Erro 1 — `origem` estava recebendo ID em vez de nome do layout.**
Corrigir: `origem` recebe `layouts_complementares.nome` (texto), nunca UUID.

**Erro 2 — matching só olhava o layout recém-importado, podendo deixar `vinculado` escondendo ambiguidade real.**
Correto: para cada `chave_normalizada` afetada, contar **todos** os layouts complementares que possuem aquela chave e decidir status com base no total.

## Regra oficial de conferência (passa a valer no fluxo complementar)

Para cada `chave_normalizada` afetada por uma importação:

```text
n = COUNT DISTINCT(layout_complementar_id)
    em registros_complementares
    WHERE chave_normalizada = X

n = 0  → conferencia.status = 'aguardando', origem = NULL
n = 1  → conferencia.status = 'vinculado',  origem = nome do layout
n > 1  → conferencia.status = 'ambiguo',    origem = NULL
```

Aplicado **incrementalmente**: só recalcula chaves tocadas pela importação atual. Sem reset global. Sem mexer em `registros_base`.

## Diagnóstico do estado atual (inalterado)

- Backend pronto: `registros_complementares` com UNIQUE `(layout_complementar_id, chave_normalizada)`, índice em `chave_normalizada`, `conferencia` com UNIQUE em `chave_normalizada`, `import_lock` global.
- Build quebrado: `ProgressoImportacaoBase` referenciado mas não declarado em `src/types/importacao.ts`.
- UI complementar mockada em `Importacao.tsx`.
- Edge `importar-complementar` não existe.

## Implementação

### 1. Corrigir build (mínimo)
`src/types/importacao.ts`: declarar e exportar `ProgressoImportacaoBase` (movido do service). Service passa a importar do types. Sem outras mudanças no service.

### 2. Edge function `supabase/functions/importar-complementar/index.ts`

Espelha estrutura de `importar-base`. Diferenças:

- **Body**: `{ layout_complementar_id, nome_arquivo, linhas }` validado.
- **Carregar layout** ativo + `nome` (será usado como `origem`). Erro se inativo/inexistente.
- **Lock**: mesma `import_lock` (1 por vez global).
- **Importação registrada** com `tipo='complementar'`, `layout_id=layout_complementar_id`.
- **Normalização** idêntica (contrato, nota → chave `contrato::nota`; placa).
- **Filtro base obrigatório**: BATCH SELECT em `registros_base` por `chave_normalizada` (chunks de 150). Linhas cuja chave **não existe na base** → `ignorados_sem_base++`. Nunca cria base.
- **Classificar contra `registros_complementares`** filtrado por `layout_complementar_id`:
  - inexistente → INSERT
  - existente, dados normalizados iguais → ignorar
  - existente, mudou → UPDATE
- **BATCH INSERT/UPDATE** (chunks de 500).
- **Recálculo de conferência (multi-layout)** — apenas para `chavesAfetadas` (todas as chaves do arquivo que existem na base, independente de ter sido inserido/atualizado/ignorado, porque o estado pode ter mudado em outras importações):
  1. SELECT `chave_normalizada, layout_complementar_id` em `registros_complementares` WHERE `chave_normalizada IN (chavesAfetadas)` (chunks de 150).
  2. Em memória: `Map<chave, Set<layout_id>>`.
  3. Para cada chave:
     - `Set.size === 0` → `{ status: 'aguardando', origem: null }`
     - `Set.size === 1` → buscar nome do único layout (1 SELECT em `layouts_complementares` filtrando por todos os IDs únicos encontrados na rodada → Map id→nome) → `{ status: 'vinculado', origem: nome }`
     - `Set.size > 1` → `{ status: 'ambiguo', origem: null }`
  4. **BATCH UPSERT** em `conferencia` (chunks de 500) com `onConflict: 'chave_normalizada'`.
- **Resumo retornado**:
  - `total_linhas, inseridos, atualizados, ignorados, ignorados_sem_base`
  - `vinculados, aguardando, ambiguos` = contagem do estado **das chaves afetadas** após recálculo (não estado global do banco)
  - `divergentes = 0` (fora desta entrega — diagnóstico secundário Nota+Placa permanece próximo passo)
  - `erros, primeiro_erro`
- **Liberar lock** em qualquer caminho (try/finally).

### 3. Service `src/services/importacaoBaseService.ts`

Adicionar:
- `listarLayoutsComplementaresAtivos()` → `[{ id, nome }]` para o dropdown.
- `carregarLayoutComplementarAtivo(layoutId)` → layout + colunas, validando obrigatórios (`contrato_vinculado`, `nota_fiscal` via `normalizaTipo` já existente; `placa` opcional).
- `importarComplementar(file, layoutId, onEtapa, onTotalPreparado)` → reusa `parseExcelFile()` (mesma shape `LayoutResolvido`), invoca edge `importar-complementar`, mesmo tratamento de erro do `importarBase`.

Sem alterar nada do fluxo base.

### 4. UI `src/pages/Importacao.tsx`

- Carregar `listarLayoutsComplementaresAtivos()` no mount.
- Reativar card "Relatório Complementar":
  - Dropdown populado com layouts reais (estado vazio → mensagem com link para `/configuracoes`).
  - Upload de arquivo.
  - Botão "Importar Complementar" desabilitado até ter layout + arquivo.
  - Validação local antes de enviar (mesma do base).
- Estado paralelo: `layoutComplementarId, arquivoComplementar, importandoComplementar, etapaComplementar, resumoComplementar, erroComplementar`.
- Reusa o painel "Resultado da Importação Atual" exibindo o último resumo (base ou complementar) com seus campos próprios; complementar adiciona `Ignorados sem base na linha`.
- Ao final: `carregarConsolidado()` para refletir vinculados/ambíguos atualizados.
- Erros propagados sem mascarar.

### 5. Sem mudanças
- Schema, RLS, `registros_base`, `Configuracoes.tsx`, edge `importar-base`, edge `limpar-dados-importados`, conferência (página).

## Aderência aos PRDs

- **Chave `contrato + nota`** + normalização: idêntica.
- **Complementar não cria/altera/remove base**: apenas SELECT em `registros_base`; chaves órfãs viram `ignorados_sem_base`.
- **`origem` = nome do layout**: tirado de `layouts_complementares.nome`, nunca UUID.
- **Status `vinculado / aguardando / ambiguo`**: calculado por contagem distinta de layouts por chave, considerando estado completo do banco (multi-layout).
- **Incremental**: só recalcula chaves do arquivo atual.
- **Indexado**: SELECTs por `chave_normalizada` (índice existente), sem N×N.
- **Lock global**: 1 importação por vez.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/types/importacao.ts` | + `ProgressoImportacaoBase`; campos opcionais no `ResumoImportacao` (`ignorados_sem_base`) |
| `src/services/importacaoBaseService.ts` | Importa tipo do types; + `importarComplementar`, + `listarLayoutsComplementaresAtivos`, + `carregarLayoutComplementarAtivo` |
| `src/pages/Importacao.tsx` | Reativa card complementar com fluxo real |
| `supabase/functions/importar-complementar/index.ts` | **Novo** — importação + recálculo multi-layout de conferência |

## Resultado esperado

- Build volta a passar.
- Importar complementar respeita base como verdade (não cria/altera).
- `conferencia.origem` mostra nome legível do layout (ex: "Bunge", "Inpasa") quando `vinculado`.
- Chave com 2+ layouts batendo vira `ambiguo` automaticamente, mesmo que tenha sido `vinculado` antes.
- Chave que perdeu o último complementar volta a `aguardando` (recálculo cobre esse caso quando a chave aparece numa nova importação).
- Resumo mostra: total, inseridos, atualizados, ignorados, ignorados_sem_base, vinculados, aguardando, ambiguos.

