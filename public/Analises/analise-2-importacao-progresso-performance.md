# Análise — `/importacao` progresso visual e performance

## 1. Resumo executivo
Parcialmente. O sistema já tem base para feedback visual **de fases** e para exibir **contadores finais reais** sem degradar performance, mas **não tem telemetria em tempo real** para percentual confiável nem para “X de Y processados” durante a execução. Hoje o maior risco é percepção de travamento durante a chamada única à Edge Function.

## 2. Situação atual
- Frontend mostra etapas textuais (`validando`, `lendo`, `enviando`, `persistindo`, `matching`, `diagnostico`, `atualizando_conferencia`, `finalizando`).
- Porém, após `supabase.functions.invoke("importar-base")`, as etapas finais são emitidas no cliente somente depois da resposta retornar; isso reduz valor como progresso real em tempo de execução.
- O backend processa em pipeline síncrono:
  1) normaliza e filtra linhas
  2) busca existentes por chave em lotes
  3) classifica insert/update/ignore
  4) insere em lote
  5) faz updates em paralelo controlado
  6) reprocessa conferência por chaves afetadas
  7) lê status final da conferência para montar resumo
- O resumo retornado ao frontend já é real no final do processamento: total, inseridos, atualizados, ignorados, vinculados, aguardando, divergentes, ambíguos, erros.

## 3. Viabilidade de progresso real
### 3.1 Hoje existe base técnica para progresso real?
**Resposta: parcialmente.**

- **Fase real do backend em tempo real:** **não** (não há canal de progresso incremental do servidor para o cliente durante a execução).
- **Percentual real em tempo real:** **não** (não existe contador progressivo publicado por etapa/linha durante o processamento).
- **Quantidade processada em tempo real:** **não** (backend não publica “X de Y” durante execução).
- **Quantidade final persistida/resultado final:** **sim** (resumo é retornado ao final com números reais).

### 3.2 O percentual seria real ou artificial?
**Hoje seria majoritariamente artificial/estimado** se mostrado durante a requisição atual.

Risco: exibir “percentual” sem métrica real de avanço por linha/lote pode induzir usuário a erro operacional (progresso visual desacoplado do estado real do backend).

### 3.3 Existe caminho simples para mostrar quantidade processada?
**Sem grande refatoração, apenas parcialmente:**
- viável exibir melhor “etapa atual conhecida” no frontend (pré-validação/leitura/envio e processamento em andamento);
- viável exibir “total enviado para processamento” (Y) antes do invoke;
- **não viável** exibir “X de Y processados” real durante execução sem mecanismo adicional de progresso no backend.

## 4. Gargalos de performance encontrados
- **Parsing no frontend (XLSX):** pode ficar pesado para arquivos grandes (memória + CPU no navegador), antes mesmo do envio.
- **Payload grande para Edge Function:** envio de `linhas` completas em um único request pode aumentar latência percebida.
- **Classificação e seleção por chave:** já mitigado por chunking; ainda sensível ao volume total de chaves.
- **Updates individuais (em paralelo controlado):** é o ponto com maior custo potencial quando há muitos updates (não há update em lote nativo via PostgREST).
- **Reprocessamento conferência:** está incremental por chaves afetadas (bom), mas ainda adiciona custo linear ao volume afetado.
- **Leitura final de status da conferência:** mais uma etapa de I/O ao final; custo adicional proporcional às chaves processadas.

## 5. Melhor ajuste mínimo recomendado
Para o estado atual, a opção mais segura é:

1. **manter progresso textual honesto por fases** (sem percentual numérico “de fachada”);
2. **explicitar claramente “processamento no servidor em andamento”** durante o período de espera do invoke;
3. **mostrar resumo final real** (já implementado) como fechamento confiável.

Essa abordagem melhora percepção de progresso agora, com baixo risco de regressão e sem custo relevante de performance.

## 6. O que não recomendar agora
- Não recomendar barra percentual contínua sem telemetria real de backend.
- Não recomendar “X de Y processados” em tempo real sem contador incremental real.
- Não recomendar websocket/polling complexo/fila assíncrona neste momento (escopo e custo acima do necessário para o ajuste mínimo).
- Não recomendar animações que simulem progresso sem relação com estado real do processamento.

## 7. Conclusão objetiva
- **Dá para melhorar a percepção de progresso agora?** Sim, com feedback textual mais explícito e honesto durante a espera.
- **Isso pode ser feito sem degradar performance?** Sim, porque é ajuste principalmente de UX textual e não de processamento pesado.
- **Qual abordagem é mais recomendada neste momento?** Manter/aperfeiçoar status textual por fases + resumo final real; evitar percentual em tempo real até existir base técnica de telemetria incremental no backend.

**Incertezas explícitas:**
- Não há, no escopo inspecionado, mecanismo de emissão de progresso incremental do backend para o frontend. Se existir infra externa não referenciada aqui (ex.: logs operacionais convertidos em feed de progresso), ela não está visível neste código.
