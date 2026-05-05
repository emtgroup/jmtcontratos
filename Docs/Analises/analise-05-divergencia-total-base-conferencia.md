# Análise 05 — Divergência entre total da Base e total da Conferência

## 1) Diagnóstico encontrado

Foi identificada divergência estrutural entre o universo da Base e o universo materializado em `conferencia`:

- A importação e o motor estavam reprocessando **somente chaves afetadas** (incremental), conforme PRD.
- Porém, não havia garantia explícita de **cobertura histórica completa** quando existissem lacunas prévias em `conferencia`.
- Resultado: era possível ter `registros_base` com chaves válidas sem linha correspondente em `conferencia`, causando totais menores na tela `/conferencia`.

## 2) Evidências técnicas

### 2.1 Regras dos PRDs
- PRD principal: Base é fonte de verdade e conferência é materializada no backend.
- Motor: conferência deve refletir estado atual da Base + Complementar.
- Tela de conferência: frontend só lê resultado oficial materializado.

### 2.2 Código antes da correção
- `importar-base` calculava `chavesAfetadas` apenas por inserções/atualizações da importação atual e recalculava apenas esse subconjunto.
- `importar-complementar` recalculava apenas as chaves válidas presentes no arquivo complementar atual.
- Não havia etapa de backfill para preencher chaves históricas da Base faltantes em `conferencia`.

### 2.3 Fonte de dados das telas
- `/importacao` exibe `total_registros_base` diretamente de `registros_base`, e status via contagens em `conferencia`.
- `/conferencia` lista e conta diretamente de `conferencia` (com filtros/paginação server-side).
- Portanto, se `conferencia` estiver incompleta, `/conferencia` mostrará universo menor, mesmo com Base maior.

## 3) Causa raiz

**Causa raiz:** ausência de mecanismo de cobertura/backfill de chaves da Base sem conferência durante o fluxo incremental.

O incremental por chaves afetadas está correto pelo PRD, mas sozinho não corrige lacunas históricas já existentes em `conferencia`.

## 4) Arquivos/funções/tabelas afetadas

- `supabase/functions/importar-base/index.ts`
  - Nova função `expandirChavesComBackfillBaseSemConferencia`.
  - Fluxo de atualização de conferência passou a usar `chavesParaRecalcular` (afetadas + faltantes).
- `supabase/functions/importar-complementar/index.ts`
  - Mesma correção de cobertura/backfill.
- Tabelas envolvidas:
  - `registros_base`
  - `registros_complementares`
  - `conferencia`

## 5) Correção mínima aplicada

Correção localizada e reversível, sem refatoração de arquitetura:

1. Mantido o reprocessamento incremental por chaves afetadas.
2. Adicionada expansão idempotente de chaves a recalcular:
   - lê chaves de `registros_base`;
   - lê chaves já presentes em `conferencia`;
   - identifica chaves faltantes da Base em `conferencia`;
   - une `chavesAfetadas + chavesFaltantes`.
3. Recalcula conferência para esse conjunto expandido.

### Efeito esperado
- Garante 1:1 lógico entre Base válida e conferência materializada.
- Registros sem complementar continuam em `aguardando`.
- Sem duplicidade (upsert por `chave_normalizada`, respeitando `UNIQUE`).

## 6) SQLs/queries de validação utilizados

> Executar no banco alvo para validar o estado real dos dados.

```sql
-- 1) Total de registros válidos na base
select count(*) as total_base from registros_base;

-- 2) Total materializado na conferência
select count(*) as total_conferencia from conferencia;

-- 3) Chaves da base sem linha na conferência
select count(*) as chaves_sem_conferencia
from registros_base b
left join conferencia c
  on c.chave_normalizada = b.chave_normalizada
where c.chave_normalizada is null;

-- 4) Distribuição de status na conferência
select status, count(*)
from conferencia
group by status
order by status;

-- 5) Amostra de pendências reais (sem complementar por chave)
select b.chave_normalizada, b.contrato_vinculado, b.nota_fiscal
from registros_base b
left join registros_complementares rc
  on rc.chave_normalizada = b.chave_normalizada
where rc.chave_normalizada is null
limit 50;
```

## 7) Checklist final de testes

- [ ] Contagem `registros_base` x `conferencia` após importação base/complementar.
- [ ] `chaves_sem_conferencia = 0`.
- [ ] Registros sem complementar permanecem `aguardando`.
- [ ] Reimportação idêntica não duplica nem altera indevidamente totais.
- [ ] Importação complementar atualiza somente chaves afetadas e preserva demais linhas da conferência.
- [ ] Tela `/conferencia` passa a refletir o universo completo materializado.

## 8) Pontos de atenção para não quebrar PRDs

- Não mover matching/diagnóstico para frontend.
- Não criar chave alternativa.
- Não usar placa como chave.
- Não substituir fluxo incremental por carga destrutiva.
- Não alterar semântica de status (`vinculado`, `aguardando`, `divergente`, `ambiguo`).
- Preservar idempotência via `upsert` por `chave_normalizada`.

