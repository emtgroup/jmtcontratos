# Análise 2 — Progresso real da importação Base com telemetria mínima

## Diagnóstico técnico

### Como a importação Base é disparada hoje
- A tela `src/pages/Importacao.tsx` chama `importarBase(...)` do serviço `src/services/importacaoBaseService.ts`.
- O serviço faz parse/local validation e dispara uma chamada única para a Edge Function `importar-base`.

### Como a Edge Function processa os lotes
- Fluxo atual do backend (mantido):
  1. valida lock e concorrência
  2. cria registro em `importacoes`
  3. normaliza linhas e filtra inválidas
  4. busca existentes por chave em lotes
  5. classifica para inserir/atualizar/ignorar
  6. persiste inserções/atualizações
  7. atualiza conferência de chaves afetadas
  8. consolida resumo e finaliza

### `importacao_id` já existe desde o início?
- Sim. O registro em `importacoes` já era criado no início da função.
- Portanto, o menor caminho é reutilizar esse `importacao_id` como chave de telemetria em tempo real.

### Em qual momento a linha é gravada em `importacoes`?
- Logo após validar o request e antes de processar os lotes pesados.

### Hoje é possível atualizar `importacoes` durante processamento?
- Sim. A mesma Edge Function já possui privilégio para atualizar tabelas durante o fluxo.
- Não exige nova arquitetura.

### Melhor ponto para persistir telemetria sem quebrar o fluxo
- Atualizar em **marcos de etapa** e **por lote** (não por linha):
  - início/etapa
  - checkpoints a cada X linhas na normalização
  - após cada lote de insert/update
  - atualização de conferência
  - consolidação/finalização/erro

---

## Solução escolhida (menor possível)

### Banco (telemetria mínima)
Foi adicionada telemetria na própria tabela `importacoes`:
- `status_processamento` (`processando` | `finalizado` | `erro`)
- `etapa_atual`
- `linhas_processadas`
- `erros`
- `updated_at`

Campos já existentes e reutilizados para progresso:
- `total_linhas`
- `inseridos`
- `atualizados`
- `ignorados`

Também foi criado trigger de `updated_at` para `importacoes`.

### Edge Function
- Mantém a lógica de negócio existente.
- Passa a persistir telemetria em marcos reais:
  - etapa atual
  - linhas processadas na normalização (checkpoint)
  - contadores parciais reais por lote
  - status final ou erro
- O update não ocorre por linha para evitar overhead.

### Frontend
- Implementado polling leve (1.5s) enquanto a importação está ativa.
- Descoberta do `importacao_id` ativo via `import_lock`.
- Leitura de telemetria em `importacoes` usando somente dados reais.
- Exibição de:
  - percentual real (`linhas_processadas / total_linhas`)
  - etapa atual real do backend
  - contadores parciais reais
- Polling encerra em conclusão/erro e no unmount.

---

## Por que essa foi a menor solução possível
1. Reutiliza estrutura existente (`importacoes` + `import_lock` + Edge Function atual).
2. Não introduz fila, websocket, SSE ou worker.
3. Não altera regras de matching/chave/conferência.
4. Acrescenta apenas telemetria incremental auditável.

---

## Campos adicionados/alterados

### Tabela `importacoes`
- **Novos campos**: `status_processamento`, `etapa_atual`, `linhas_processadas`, `erros`, `updated_at`.
- **Campos reutilizados para progresso**: `total_linhas`, `inseridos`, `atualizados`, `ignorados`.

### Fluxo de atualização
- Atualização por etapa/lote/finalização (sem update por linha).

---

## Impacto de performance
- Overhead controlado: updates de telemetria são feitos em marcos de processamento e com pequeno throttle no backend.
- Evita escrita excessiva por linha.
- Polling de frontend é leve e limitado ao período de importação ativa.

---

## Limitações restantes
1. O polling usa lock global da importação ativa (compatível com regra de 1 importação por vez).
2. Não há timeline histórica detalhada de cada etapa (apenas estado corrente incremental).
3. Em cenários de falha abrupta de infraestrutura, pode haver curto atraso até refletir o último estado.

---

## Riscos remanescentes (baixos)
1. Aumento discreto de writes em `importacoes` durante importações muito grandes.
2. Dependência da consistência do `import_lock` para descoberta do `importacao_id` no frontend.

