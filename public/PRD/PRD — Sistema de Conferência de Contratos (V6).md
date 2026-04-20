
````markdown
# 📘 PRD — Sistema de Conferência de Contratos (V6)

---

# 1. 🎯 Objetivo do Sistema

Criar um sistema **determinístico, simples, auditável e operacional** para:

- Conferir contratos agrícolas
- Validar vínculos entre Base (GRL053) e Relatórios Complementares
- Identificar registros:
  - vinculados
  - aguardando
  - divergentes
  - ambíguos
- Manter dados consistentes, sem duplicidade e sem perda de informação

---

# 2. ❌ O que o sistema NÃO é

- Não usa IA
- Não usa heurística
- Não tenta adivinhar dados
- Não interpreta sem regra definida
- Não altera dados automaticamente
- Não remove dados automaticamente

---

# 3. ✅ Princípios do Sistema

- Determinístico
- Baseado em chave fixa
- Incremental (não destrutivo)
- Sem duplicidade
- Auditável
- Independente da ordem de importação
- Simples (modelo Excel)

---

# 4. 🧱 Estrutura do Sistema

## 4.1 Histórico de Importações

Armazena todos os arquivos importados:

- tipo (Base ou Complementar)
- nome do arquivo
- data/hora
- resumo da importação

Uso exclusivo para auditoria.

---

## 4.2 Base Operacional (GRL053)

Tabela consolidada contendo:

> exatamente 1 registro por chave

Fonte oficial do sistema.

---

## 4.3 Complementar Operacional

Tabela consolidada contendo:

> exatamente 1 registro por chave por layout complementar

---

## 4.4 Motor de Processamento

Responsável por:

- normalização
- geração da chave
- persistência incremental
- matching
- diagnóstico secundário
- atualização da conferência

---

# 5. ⚠️ Regra de Ouro

> Se não existe na Base, não existe no sistema.

---

# 6. 🧩 Tipo da Coluna

O sistema funciona por **tipo**, não por nome.

Tipos principais:

- Contrato vinculado
- Nota fiscal
- Placa
- Peso
- Data
- Clifor

---

# 7. 🔑 Regra de Chave (FIXA E IMUTÁVEL)

```txt
CHAVE = contrato_vinculado + nota_fiscal
````

---

## Regras

* não configurável
* ordem fixa
* baseada no tipo da coluna
* única forma de identificação do registro

---

# 8. 🧼 Regra Global de Normalização

## Contrato vinculado

* remover caracteres não numéricos (exceto hífen)
* considerar apenas o primeiro bloco antes do hífen
* manter apenas números

---

## Nota fiscal

* manter apenas números

---

## Placa

* converter para maiúsculo
* remover espaços
* remover hífen

---

## Regra obrigatória

Nenhum dado pode ser utilizado sem normalização prévia.

---

## Comentário do ajuste 4 — Regra de chave inválida após normalização

Se após normalização:

* contrato_vinculado resultar vazio
ou
* nota_fiscal resultar vazia

O registro deve:

→ ser descartado
→ NÃO gerar chave_normalizada
→ ser tratado como erro de normalização

---

# 9. 📌 Regra de Identidade

Cada chave representa:

> exatamente 1 registro único

Nunca pode existir duplicidade.

---

## Comentário do ajuste 6 — Definição de registro válido

Um registro é considerado válido quando:

* possui contrato_vinculado válido
* possui nota_fiscal válida
* foi normalizado com sucesso
* possui chave_normalizada válida

Caso qualquer condição falhe:

→ o registro NÃO deve ser persistido
→ o registro NÃO participa do sistema

---

# 10. 📥 Regra de Importação da Base (GRL053)

## Modelo

Importação **incremental acumulativa**

---

## Para cada linha:

* chave não existe → INSERIR
* chave existe:

  * comparar os dados normalizados relevantes
  * se houver qualquer diferença → ATUALIZAR
  * se NÃO houver diferença → IGNORAR

---

## Comentário do ajuste 3 — Campos relevantes para comparação

Campos relevantes para comparação:

* contrato_vinculado
* nota_fiscal
* placa_normalizada

Campos analíticos (peso, data, clifor, etc):
* NÃO devem disparar atualização
* são apenas informativos

---

## Comentário do ajuste 1 — Base de comparação obrigatória

A comparação deve ser feita EXCLUSIVAMENTE com base nos dados já normalizados.

É proibido utilizar:
* dados_originais completos
* valores brutos do Excel
* strings sem normalização

A comparação deve considerar apenas os campos estruturais já normalizados.

---

## Regra crítica

* ausência de um registro em nova importação NÃO remove dados
* importação NÃO substitui a base
* importação NÃO apaga registros anteriores

---

# 11. 📥 Regra de Importação do Complementar

Para cada linha:

* chave não existe na base → IGNORAR
* chave existe:

  * não existe no complementar → INSERIR
  * existe:

    * comparar os dados normalizados relevantes
    * se houver qualquer diferença → ATUALIZAR
    * se NÃO houver diferença → IGNORAR

---

## Comentário do ajuste 1 — Base de comparação obrigatória no complementar

A comparação deve ser feita EXCLUSIVAMENTE com base nos dados já normalizados.

É proibido utilizar:
* dados_originais completos
* valores brutos do Excel
* strings sem normalização

A comparação deve considerar apenas os campos estruturais já normalizados.

---

## Proibições

* complementar NÃO cria registros na base
* complementar NÃO altera contrato da base
* complementar NÃO remove dados

---

# 12. 🔁 Regra de Persistência

```txt
Importação NÃO é sincronização total.

Importação é atualização incremental por chave.
```

---

## Comportamento

* dados são acumulados ao longo do tempo
* múltiplas importações são suportadas
* ordem de importação não altera o resultado final

---

# 13. 🔗 Regra de Matching

Match ocorre quando:

* chave existe na Base
* chave existe no Complementar

---

## Resultado

* existe nos dois → Vinculado
* existe apenas na Base → Aguardando

---

## Comentário do ajuste 5 — Matching unidirecional e baseado na Base

O matching é sempre executado a partir da Base.

Para cada registro da Base:

* buscar correspondente nos registros complementares
* definir o status com base nessa busca

O Complementar nunca inicia matching.
O Complementar nunca cria vínculo por conta própria.

---

## Comentário do ajuste final 1 — Ordem obrigatória de processamento

Ordem obrigatória de processamento:

1. Executar matching principal utilizando:
   contrato_vinculado + nota_fiscal

2. Apenas se NÃO houver match:
   executar diagnóstico secundário (nota + placa)

Regras:

* É proibido executar diagnóstico secundário antes do matching principal
* É proibido misturar critérios de matching com diagnóstico

---

## Comentário do ajuste final 3 — Múltiplos layouts complementares válidos

Se múltiplos layouts complementares retornarem correspondência válida para a mesma chave:

→ o registro deve ser classificado como "Ambíguo"
→ a origem deve ser NULL

Regras:

* o sistema NÃO deve escolher automaticamente entre layouts
* o sistema NÃO deve priorizar layouts
* a decisão deve ser sempre explícita para o usuário

---

# 14. 🔎 Diagnóstico Secundário (DEFINITIVO)

---

## Quando executar

Somente quando NÃO houver match por:

```txt
Contrato + Nota
```

---

## Critério

```txt
Nota + Placa
```

---

## Comentário do ajuste 1 — Regra de execução

O diagnóstico secundário (Nota + Placa) só deve ser executado quando:

* a nota fiscal for válida
* a placa for válida

Considera-se placa válida quando:
* não é nula
* não é vazia
* após normalização possui pelo menos 1 caractere

Caso a placa seja inválida ou ausente:
→ NÃO executar diagnóstico secundário
→ manter status como "Aguardando"

---

## Regra de execução

### Caso 1 — Placa válida

* buscar registros no complementar com:

  * mesma nota
  * mesma placa

Resultado:

* 1 registro:

  * contrato diferente → Divergente
* mais de 1:
  → Ambíguo
* nenhum:
  → Aguardando

---

### Caso 2 — Placa inválida ou ausente

* NÃO executar diagnóstico secundário

Resultado:

→ manter como Aguardando

---

## Regra crítica

```txt
Placa NÃO faz parte da chave.

Placa é usada exclusivamente para diagnóstico.
```

---

# 15. 📊 Regra de Conferência

| Status     | Condição                                    |
| ---------- | ------------------------------------------- |
| Vinculado  | match por chave                             |
| Aguardando | sem match                                   |
| Divergente | match por nota+placa com contrato diferente |
| Ambíguo    | múltiplos candidatos                        |

---

# 16. ⚖️ Regra de Peso

* não influencia status
* apenas informativo

---

# 17. 🚫 Proibições

O sistema NÃO deve:

* duplicar registros
* excluir registros automaticamente
* inferir dados
* corrigir dados automaticamente
* depender da ordem de importação

---

# 18. 🔁 Regra de Reprocessamento

Após cada importação:

* identificar chaves afetadas
* reprocessar SOMENTE essas chaves

---

## Comentário do ajuste final 2 — Reprocessamento após alteração

Se um registro já vinculado sofrer alteração em dados relevantes:

→ o registro deve ser reprocessado automaticamente
→ o status deve ser recalculado

Regras:

* o sistema NÃO deve manter status antigo após alteração
* o status deve sempre refletir o estado atual dos dados

---

# 19. ⚡ Performance

* index obrigatório por chave_normalizada
* proibido loop N x N
* processamento sempre orientado a chave

---

# 20. 📦 Resultado da Importação

Exibir:

* total de linhas lidas
* registros inseridos
* registros atualizados
* registros ignorados

---

# 21. 🚨 Regra de Erro

* erro deve ser explícito
* não pode existir falha silenciosa
* não pode existir inconsistência parcial

---

## Comentário do ajuste 8 — Erro de normalização

Se não for possível normalizar:

* contrato_vinculado
ou
* nota_fiscal

O registro deve:
→ ser ignorado
→ ser contabilizado como erro
→ NÃO ser persistido

---

# 22. 🔒 Regra de Concorrência

* permitido apenas 1 processo de importação por vez
* bloquear importações simultâneas

---

# 23. 🔄 Nova Análise (Opcional)

Ao executar:

* limpar Base operacional
* limpar Complementar operacional
* limpar conferência

---

## Regra

* só pode ocorrer por ação explícita do usuário

---

# 24. 🧱 Estrutura Mínima do Registro (OBRIGATÓRIA)

Cada registro deve conter:

* chave_normalizada
* contrato_vinculado
* nota_fiscal
* placa_normalizada (se existir)
* dados_originais (json)
* ultima_importacao_id
* updated_at

---

# 25. 🔄 Regra de Atualização (DEFINITIVA)

Atualizar somente quando:

* existir diferença em QUALQUER campo normalizado relevante

Nunca atualizar sem comparação.

---

# 26. 🧠 Filosofia Final

O sistema não interpreta.
O sistema não decide.

O sistema:

> aplica regras fixas e mostra onde investigar.

---

# 27. 🎯 Resultado Esperado

✔ previsível
✔ auditável
✔ consistente
✔ sem perda de dados
✔ sem duplicidade
✔ operacional real

```

---
