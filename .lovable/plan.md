

# Plano: Corrigir Importação Base GRL053 (causa raiz + UX)

## Diagnóstico (causa real)

Estado atual no banco confirma o problema:
- Última importação: `GRL053 COOPERAGRO.xlsx`, **6410 linhas**, status `em_andamento`, 0 inseridos, **lock travado** desde então.
- Apenas 4 registros na base (testes antigos).

**Causas reais, em ordem de impacto:**

1. **Edge Function processa linha-a-linha com 2–3 round-trips por linha** (SELECT → INSERT/UPDATE → upsert conferência). 6410 linhas ≈ **19.000+ chamadas HTTP ao Postgres**. Estoura o limite de tempo da Edge Function (~150s wall-clock) muito antes de terminar. Esse é o motivo do "trava e falha no final".
2. **Layout fixo no frontend** (`LAYOUT_BASE_DEFAULT` em `importacaoBaseService.ts`) ignora completamente `layouts_base_colunas` salvo em /configuracoes. Para um GRL053 real (cabeçalho na linha 2, dados na linha 3), o parser também lê a partir da linha errada.
3. **Lock fica preso** quando a função morre por timeout — não existe nenhum mecanismo automático de release (o `catch` só roda se a função retornar; timeout kill não dispara `catch`).
4. **Erros silenciados**: `catch { erros++ }` engole exceções reais; o front mostra "Erro desconhecido" porque `supabase.functions.invoke` envelopa em `FunctionsHttpError`.
5. **Sem progresso visual** durante a importação.

## Correção mínima e segura

### 1. Edge Function — eliminar N round-trips (prioridade #1: integridade + performance)

Reescrever `supabase/functions/importar-base/index.ts` para usar **batches**:

- **1 SELECT** trazendo todas as `chave_normalizada` já existentes para o conjunto de chaves do arquivo (`.in('chave_normalizada', chavesDoArquivo)`), em chunks de 1000 (limite do PostgREST).
- Comparar em memória (Map) → classificar cada linha em **inserir / atualizar / ignorar**.
- **INSERT em batch** (chunks de 500) usando `.insert([...])`.
- **UPSERT em batch** em `conferencia` apenas para as chaves novas (status `aguardando`).
- **UPDATE**: agrupar e executar em chunks; manter por linha apenas onde `dadosChanged`.
- Resultado: para 6410 linhas → ~30 chamadas totais ao DB em vez de 19.000. Vai concluir em poucos segundos.

### 2. Edge Function — tornar lock à prova de timeout

- Antes de adquirir o lock, checar se `locked_at` é mais antigo que **5 minutos** → tratar como lock órfão e liberar automaticamente.
- Liberar lock também em qualquer caminho de erro (já existe; manter).

### 3. Edge Function — propagar erros reais

- Trocar `catch { erros++ }` por `catch (e) { erros++; primeiroErro ??= e.message; }` e devolver `primeiro_erro` no resumo.
- Front exibe a mensagem técnica real (coluna X, constraint, etc.).

### 4. Frontend service — ler layout REAL do banco

`src/services/importacaoBaseService.ts`:

- Buscar `layouts_base` ativo + `layouts_base_colunas` antes do parse.
- Validar que existe **exatamente 1** coluna do tipo `contrato_vinculado` e **1** de `nota_fiscal` (regra do PRD); se não → erro claro: `"Layout base inválido: tipo X ausente/duplicado"`.
- Usar `linha_cabecalho` e `linha_dados` do layout (não mais hardcoded).
- Mapear coluna por **letra do Excel salva como `nome_coluna_excel`** (ex: "A", "B", "AC"). Se o usuário salvou nome textual em vez de letra → erro claro: `"Coluna 'X' não é uma letra Excel válida"`.
- Validar antes do upload: se alguma coluna obrigatória não existir na planilha → erro com nome da coluna.

### 5. Frontend page — feedback de progresso real

`src/pages/Importacao.tsx`:

- Adicionar estado `etapa: 'lendo' | 'validando' | 'enviando' | 'processando' | null`.
- Mostrar texto da etapa + spinner. (Sem WebSocket: a etapa "processando" cobre todo o tempo da Edge Function, mas com a otimização de batch isso vira ~5–10s, aceitável.)
- Mensagem de erro **bruta**, sem mascarar.
- Adicionar botão "Liberar lock travado" (chama uma função mínima que faz `update import_lock set locked=false where id=1 and locked_at < now()-interval '5 min'`) — fallback manual.

### 6. Liberar lock atual travado

Migration (uma linha): `UPDATE import_lock SET locked=false, locked_at=null, importacao_id=null WHERE id=1;` — para destravar o estado atual.
Junto: marcar a importação `em_andamento` órfã como `falhou`.

## Fora deste escopo (não tocar)

- Importação complementar (continua desabilitada na UI)
- Matching/diagnóstico secundário (próxima entrega)
- Redesign visual da tela
- Refatoração da arquitetura
- Conferência (continua só `aguardando` no insert)

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/importar-base/index.ts` | Reescrita com batching + lock órfão + erro real |
| `src/services/importacaoBaseService.ts` | Ler layout real do banco; validações antes do upload |
| `src/pages/Importacao.tsx` | Estados de etapa + erro bruto + botão liberar lock |
| Nova migration | Destrava lock atual + marca importação órfã como `falhou` |

## Resultado esperado

- 6410 linhas importadas em **<10s** (vs. timeout atual).
- Nenhum lock preso após falha.
- Erro mostra coluna/linha/constraint reais.
- Progresso visível por etapa.
- Layout vem de /configuracoes (não mais hardcoded).

