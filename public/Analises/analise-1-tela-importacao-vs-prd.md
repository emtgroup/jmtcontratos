# Análise — Tela `/importacao` vs PRDs

## 1. Resumo executivo
A tela `/importacao` está **parcialmente aderente** para o fluxo da Base, com pontos positivos relevantes (normalização, chave fixa, persistência incremental e lock), mas **ainda não cumpre integralmente** o comportamento esperado pelos PRDs para resultado de importação e atualização da conferência. O fluxo atualmente implementado foca em ingestão incremental da Base e não evidencia (na UI) os indicadores completos de status de conferência, nem a etapa de matching/diagnóstico secundário após atualização. Para habilitar o complementar com segurança, há necessidade de ajustes mínimos estruturais e de observabilidade do processamento.

## 2. O que está aderente
- **Importação da Base está disponível e funcionalmente separada do complementar** (complementar desabilitado), alinhado ao contexto de etapa atual.  
- **Fluxo de entrada e leitura existe na tela**: seleção de arquivo + disparo explícito do processamento (`Importar Base`).  
- **Validação de layout base ativo e colunas obrigatórias** (`contrato_vinculado` e `nota_fiscal`) antes do envio para processamento.  
- **Normalização obrigatória no backend** para contrato, nota e placa, antes da persistência.  
- **Regra de chave fixa** aplicada por concatenação de contrato + nota (implementada com separador técnico), garantindo identidade determinística.  
- **Persistência incremental não destrutiva na Base**: insere quando não existe, atualiza quando existe e mudou, ignora quando não mudou.  
- **Proteção de concorrência com lock global** (`import_lock`) e bloqueio de importações simultâneas.  
- **Tratamento de lock órfão** (timeout de 5 min) com caminho automático no backend e ação manual na UI (“Liberar lock travado”).  
- **Registro de auditoria em `importacoes`** com metadados e contadores principais (total, inseridos, atualizados, ignorados), além de status do processamento.

## 3. O que está inconsistente
- **Fluxo exibido ao usuário não representa o fluxo completo definido no PRD**. A UI mostra etapas genéricas (validando, lendo, enviando, processando), mas não explicita execução de matching, diagnóstico secundário e atualização de conferência como etapas distintas.  
- **Resultado da importação na UI diverge do PRD de importação**: hoje exibe `total`, `inseridos`, `atualizados`, `ignorados`, `erros`; o PRD exige também `vinculados`, `aguardando`, `divergentes`, `ambíguos`.  
- **Comparação para update da Base considera `dados_originais`** além dos campos normalizados relevantes. Pelo PRD, a decisão de atualizar deve se basear exclusivamente em campos normalizados estruturais relevantes.  
- **Contagem de “total lido” retornada ao usuário usa `body.linhas.length` (linhas enviadas)** e não o total bruto lido do arquivo; como o parser do front descarta linhas sem contrato/nota antes do backend, pode haver diferença sem transparência para o usuário.  
- **Atualização de conferência após importação Base está incompleta**: para inseridos, há upsert com status `aguardando`; para atualizados, não há evidência de reprocessamento/matching/diagnóstico para recalcular status conforme PRD.  
- **Status de falha no histórico**: o backend marca `falhou`, enquanto parte do esquema inicial previa `erro` (há migração corrigindo o check); funcionalmente está coerente no estado atual, mas há histórico de nomenclatura divergente no esquema evolutivo.

## 4. O que está incompleto
- **Importação complementar não está habilitada** (esperado no momento), mas também não há evidência de pipeline complementar pronto na tela para seleção dinâmica de layout e execução real.  
- **Indicadores completos de resultado pós-processamento da conferência** (`vinculados`, `aguardando`, `divergentes`, `ambíguos`) não aparecem no resumo da importação.  
- **Feedback de progresso para importações longas é básico**: há etapa textual + spinner, porém sem barra percentual, sem noção de volume processado e sem granularidade por fase de motor.  
- **Auditoria exibida ao usuário na tela é limitada**: apesar de persistir `importacoes`, a tela não mostra histórico/listagem de importações, o que reduz rastreabilidade operacional no próprio fluxo de importação.  
- **Separação explícita dos tipos de não processamento** (ex.: `erro_normalizacao` vs `ignorado_sem_alteracao` etc.) existe parcialmente em lógica interna, mas não é apresentada de forma estruturada ao usuário no resultado da tela.

## 5. Riscos de seguir para o complementar sem ajustes
- **Risco de opacidade operacional**: sem os indicadores completos de conferência no resultado da importação, o usuário não terá leitura confiável do impacto real da carga após habilitar complementar.  
- **Risco de inconsistência de status**: sem reprocessamento explícito de chaves afetadas após updates da Base, registros podem manter estado de conferência desatualizado.  
- **Risco de ruído de atualização**: ao considerar `dados_originais` no critério de update, importações podem atualizar registros por variações não estruturais, reduzindo idempotência prática e previsibilidade.  
- **Risco de suporte/diagnóstico lento**: ausência de histórico visível na própria tela pode dificultar auditoria rápida em produção quando complementar estiver ativo.

## 6. Ajustes mínimos recomendados antes do complementar
- **Ajustar o resumo de resultado da tela para incluir os indicadores exigidos no PRD**: vinculados, aguardando, divergentes e ambíguos, além dos atuais.  
- **Garantir (e tornar observável) o reprocessamento pós-importação da Base para chaves afetadas**, com atualização efetiva da conferência após insert/update.  
- **Restringir a regra de comparação de update aos campos normalizados estruturais relevantes**, conforme PRD, evitando gatilho por dados analíticos/brutos.  
- **Melhorar feedback de processamento com status mais granular** (ao menos: ingestão, persistência, matching, diagnóstico, atualização da conferência).  
- **Expor mínimo de auditoria na tela** (ao menos referência da importação executada + resumo persistido), para facilitar validação operacional antes do complementar.

## 7. Conclusão objetiva
- **A tela já está pronta para seguir?**  
  Parcialmente: pronta para importação Base básica incremental, mas não pronta para aderência plena ao PRD de resultado/processamento.

- **Precisa de ajustes antes?**  
  Sim. Especialmente em resultado exibido, reprocessamento/atualização de conferência e critério de comparação para updates.

- **O complementar pode ser habilitado agora ou ainda não?**  
  **Ainda não é recomendado habilitar agora** sem os ajustes mínimos acima, para evitar inconsistências de interpretação operacional e risco de status de conferência não refletir corretamente o estado pós-importação.

**Incertezas explícitas (sem hipótese assumida como verdade):**
- Não há evidência, no escopo analisado (`/importacao` + função `importar-base`), de um motor separado já ativo para matching/diagnóstico secundário após atualização de registros existentes; pode existir fora deste escopo, mas não foi identificado nos artefatos inspecionados.  
- Também não há evidência de endpoint complementar conectado à tela atual; a seção complementar está visualmente preparada, porém desabilitada.
