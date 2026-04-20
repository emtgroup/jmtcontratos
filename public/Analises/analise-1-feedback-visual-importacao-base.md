# Análise 1 — Feedback visual da importação Base (GRL053)

## Diagnóstico técnico do fluxo atual

### 1) Onde a importação Base é disparada
- A importação Base é acionada na tela `src/pages/Importacao.tsx`, função `handleImportBase`.
- O fluxo chama `importarBase(...)` do serviço `src/services/importacaoBaseService.ts`.

### 2) Como o frontend acompanha o processamento hoje
- O frontend já trabalha com estado local de etapa (`etapa`) e total preparado (`totalPreparado`).
- Antes desta melhoria, o feedback visual durante execução era basicamente texto + ícone de loading.
- Não havia barra visual robusta para indicar atividade contínua, e a sensação de espera longa podia parecer travamento.

### 3) Tipo de acompanhamento técnico existente
- O fluxo é `promise` única (`supabase.functions.invoke("importar-base")`) para o processamento no servidor.
- Não há stream/SSE/WebSocket.
- Não há polling de status da importação durante execução.
- O backend responde com resumo somente ao final.

### 4) O backend retorna dados parciais durante processamento?
- Não. A Edge Function `supabase/functions/importar-base/index.ts` executa processamento em lote e retorna apenas no final.
- O resumo final contém contadores reais (`inseridos`, `atualizados`, `ignorados`, `vinculados`, `aguardando`, `divergentes`, `ambiguos`, `erros`), mas sem telemetria incremental em tempo real.

### 5) Estrutura atual para etapa e contadores
- **Etapa atual (parcialmente):** sim, no frontend, por estados internos da jornada de upload/chamada.
- **Total de linhas:** sim, total preparado no cliente antes do envio (`linhas.length`).
- **Linhas processadas em tempo real:** não disponível hoje.
- **Inseridos/atualizados/ignorados/erros em tempo real:** não disponível hoje; apenas no retorno final.

---

## Causa raiz da percepção de travamento
- Durante a execução no servidor, o frontend ficava em espera da chamada única sem indicador visual mais forte de continuidade.
- Como não existe progresso percentual real exposto pelo backend, qualquer barra percentual contínua seria artificial e não confiável.

---

## Solução implementada (mínima, segura e honesta)

### Camada mínima obrigatória implementada
1. **Bloco visual de progresso reforçado** na tela de importação Base:
   - container com destaque visual de estado ativo;
   - barra **indeterminada animada** para quando não houver percentual real.
2. **Etapa atual explícita por texto** (alinhada ao fluxo real disponível):
   - validação
   - leitura
   - preparação/envio
   - processamento no servidor
   - finalização
3. **Lista de etapas com status visual** (concluída/ativa/pendente) sem inventar percentual.
4. **Mensagens operacionais de segurança** durante execução:
   - importação segue no servidor;
   - não fechar a tela;
   - arquivos maiores podem demorar.
5. **Contadores reais mantidos apenas quando verdadeiros**:
   - total preparado no cliente durante processamento;
   - resumo real final retornado pelo backend.

### Camada opcional recomendada (não implementada agora)
- Expor telemetria incremental no backend (ex.: progresso por etapa/lote) para habilitar barra percentual real.
- Não implementado neste ciclo para manter mudança pequena e sem refatoração de arquitetura.

---

## Regras do PRD preservadas
- Sem alteração de lógica de matching.
- Sem alteração de regra de chave.
- Sem recalcular conferência no frontend.
- Sem heurísticas.
- Sem alterar persistência incremental.
- Sem quebrar lock de concorrência (1 importação por vez).

---

## Arquivos alterados
- `src/pages/Importacao.tsx`
  - melhoria de feedback visual durante importação;
  - etapa atual com lista visual;
  - barra indeterminada quando percentual real não existe;
  - mensagens de segurança operacional;
  - comentários explicando pontos críticos de honestidade do progresso.

- `src/index.css`
  - adição da animação utilitária `progress-indeterminate` para barra indeterminada elegante;
  - comentário explicando o motivo de UX sem percentual fictício.

---

## Limitações atuais
1. Ainda não existe percentual real vindo do backend em tempo real.
2. Não existe contador incremental de processados/inseridos/atualizados/ignorados durante a execução.
3. O usuário recebe os contadores detalhados reais ao final da importação.

---

## Próximos passos opcionais
1. Persistir progresso incremental por `importacao_id` no backend (etapa + contadores parciais).
2. Criar endpoint leve de leitura de progresso para polling curto.
3. Habilitar barra percentual **somente** quando a métrica for real e comprovável.

