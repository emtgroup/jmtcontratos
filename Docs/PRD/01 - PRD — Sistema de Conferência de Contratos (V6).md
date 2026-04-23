# 📘 PRD — Sistema de Conferência de Contratos (V6)

## Objetivo
Definir, de forma determinística e auditável, como o sistema importa dados, consolida base e complementar, executa matching e materializa a conferência de contratos sem inferência, heurística ou comportamento implícito.

## Conceito central
- A Base (GRL053) é a fonte da verdade operacional.
- O Complementar apenas enriquece registros existentes na Base.
- A conferência é sempre derivada do processamento do backend e persistida em tabela própria.
- Chave única global e imutável: `contrato_vinculado + nota_fiscal`.
- A lógica detalhada de matching e diagnóstico está centralizada em `PRD — Motor de Matching e Diagnóstico.md`.

## Regras obrigatórias

### 1) Princípios do sistema
- Determinístico.
- Incremental e não destrutivo.
- Sem duplicidade.
- Auditável.
- Independente da ordem de importação.
- Sem inferência e sem heurística.

### 2) Regra de ouro
- Se não existe na Base, não existe no sistema para fins de conferência.

### 3) Regra de chave (fixa e global)
- `chave_normalizada = contrato_vinculado + nota_fiscal`
- Não configurável.
- Não existe chave alternativa.
- Placa **não** faz parte da chave.

### 4) Normalização global (obrigatória antes de qualquer uso)
- **Contrato vinculado:** remover caracteres não numéricos (exceto hífen), considerar apenas o primeiro bloco antes do hífen, manter apenas números.
- **Nota fiscal:** manter apenas números.
- **Placa:** maiúsculo, sem espaços e sem hífen.
- Se contrato ou nota ficarem vazios após normalização: registro inválido, sem chave, não persistido, contabilizado como erro de normalização.

### 5) Identidade e validade de registro
- Cada chave representa exatamente 1 registro válido na Base.
- Registro válido exige: contrato válido, nota válida, normalização concluída, chave válida.
- Registro inválido não participa do sistema.

### 6) Importação da Base (GRL053)
Modelo: incremental acumulativo.

Para cada linha normalizada:
- Chave não existe: **INSERIR**.
- Chave existe:
  - comparar somente campos normalizados relevantes (`contrato_vinculado`, `nota_fiscal`, `placa_normalizada`);
  - com diferença: **ATUALIZAR**;
  - sem diferença: **IGNORAR**.

Regras críticas:
- Não substituir a base inteira.
- Não remover registros ausentes no arquivo novo.
- Não apagar histórico.
- Idempotência: reimportar o mesmo arquivo não pode inserir/atualizar nem alterar status.

### 7) Importação do Complementar
Para cada linha normalizada:
- Chave não existe na Base: **IGNORAR**.
  - Não persistir operacionalmente em `registros_complementares`.
  - Não entrar na `conferencia`.
  - Apenas contabilizar no log/resumo como `ignorado_sem_base`.
- Chave existe:
  - não existe para o layout: **INSERIR**;
  - já existe para o layout:
    - diferença em campo normalizado relevante: **ATUALIZAR**;
    - sem diferença: **IGNORAR**.

Regras críticas:
- Complementar não cria Base.
- Complementar não altera contrato da Base.
- Complementar não remove dados.
- Unicidade no complementar por `layout + chave`.

### 8) Matching e diagnóstico (ordem obrigatória)
1. Matching principal por chave (`contrato + nota`), sempre partindo da Base.
2. Só sem match principal: diagnóstico secundário (`nota + placa`).

Restrições:
- Proibido executar diagnóstico antes do matching principal.
- Proibido misturar critérios de matching com diagnóstico.
- Diagnóstico secundário só roda com nota válida e placa válida (não nula, não vazia, com ao menos 1 caractere após normalização).

### 9) Definição de status da conferência
- **Vinculado:** encontrou correspondência por chave.
- **Aguardando:** sem match por chave e sem diagnóstico aplicável/conclusivo.
- **Divergente:** sem match por chave; no diagnóstico (`nota+placa`) há 1 candidato com contrato diferente.
- **Ambíguo:** múltiplos candidatos no diagnóstico (`nota+placa`) ou múltiplos layouts com correspondência válida para a mesma chave.

### 10) Regra de origem
- Com exatamente 1 correspondência válida: `origem = nome do layout`.
- Em ambiguidade: `origem = NULL`.
- Proibido origem parcial em cenário ambíguo.
- Não existe priorização automática entre layouts.
- Não existe layout preferido.

### 11) Reprocessamento
- Após cada importação, reprocessar somente chaves afetadas.
- Se registro vinculado sofrer alteração em campo relevante, recalcular status.
- Nunca manter status antigo após mudança de dados.

### 12) Conferência e frontend
- A tabela `conferencia` é a única fonte para tela de conferência.
- Frontend não executa lógica de matching/diagnóstico.
- Campos analíticos (peso, data, clifor etc.) são informativos e não alteram status.

### 13) Auditoria e concorrência
- Toda importação deve gerar log (`importacoes`) com resumo.
- Tipos internos de não processamento devem permanecer separados no log/processamento: `ignorado_sem_base`, `ignorado_sem_alteracao`, `erro_normalizacao`.
- A UI pode exibir “ignorados” de forma agregada, mas deve existir detalhamento consultável desses tipos.
- Apenas 1 importação por vez (bloqueio de concorrência).
- Erro deve ser explícito; proibida falha silenciosa.

### 14) Limpeza/Nova análise (fora do escopo desta fase)
- Limpeza não faz parte do escopo operacional fechado desta fase.
- Se existir no produto, só pode ocorrer por ação explícita do usuário.
- Fluxo técnico detalhado (permissão, recovery, implementação) depende de PRD futuro específico.

### 15) Performance
- Índice obrigatório por `chave_normalizada`.
- Proibido processamento N x N.
- Processamento orientado a chave.

## Fluxo
1. Selecionar tipo de importação (Base ou Complementar).
2. Ler arquivo e aplicar layout.
3. Normalizar dados.
4. Gerar chave.
5. Validar registro.
6. Persistir incrementalmente (inserir/atualizar/ignorar).
7. Executar matching principal.
8. Executar diagnóstico secundário quando elegível.
9. Atualizar tabela `conferencia`.
10. Registrar resumo em `importacoes` e exibir resultado.

## Edge cases
- Reimportação do mesmo arquivo: sem mudança de estado (idempotência).
- Importação parcial: permitida, sem remoção de dados antigos.
- Linha com contrato/nota inválidos após normalização: ignorada com erro de normalização.
- Complementar sem chave na Base: ignorado, com rastreabilidade no resumo.
- Múltiplos layouts válidos para a mesma chave: status ambíguo e origem nula.
- Placa ausente/inválida: não executa diagnóstico secundário; mantém aguardando.

## Proibições
- Criar chave alternativa.
- Usar placa como chave.
- Inferir, corrigir ou completar dados automaticamente.
- Excluir registros automaticamente por ausência em nova carga.
- Permitir lógica de conferência no frontend.

## Resultado esperado
- Sistema previsível apenas com leitura dos PRDs.
- Sem contradições sobre importação, matching e conferência.
- Sem comportamento implícito em cenários críticos.
- Base consolidada, complementar rastreável e conferência sempre coerente com o estado atual dos dados.
