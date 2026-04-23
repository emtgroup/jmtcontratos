# 📘 PRD — Motor de Matching e Diagnóstico

## Objetivo do motor
Consolidar a lógica determinística de decisão de conferência.

O motor:
- recebe registros já consolidados e normalizados;
- decide status e origem por regra fixa;
- produz atualização reproduzível da tabela `conferencia`.

## Conceito central
- O motor sempre processa a partir da Base.
- Não existe inferência, heurística ou fallback implícito.
- A lógica é reproduzível apenas pelos dados de entrada + regras explícitas.

## Entradas do motor
- `registros_base` válidos, normalizados e com `chave_normalizada`.
- `registros_complementares` válidos, normalizados e com `chave_normalizada`.
- Chave global fixa pronta: `contrato_vinculado + nota_fiscal`.
- Pré-condição obrigatória: linha complementar sem base já foi filtrada antes da etapa de matching e não entra no motor.

// ajuste: definição de candidato
## Definição formal de candidato
Candidato = registro complementar que atende ao critério do diagnóstico secundário (`nota_fiscal + placa_normalizada`).

Regras:
- Não existe candidato fora desse critério.
- Matching principal (por chave) não utiliza o conceito de candidato.

## Ordem obrigatória do processamento
1. Executar matching principal por chave (`contrato_vinculado + nota_fiscal`).
2. Somente sem match principal, executar diagnóstico secundário por `nota_fiscal + placa`.
3. Definir status final.
4. Definir origem.

Regras:
- Não inverter etapas.
- Não misturar critérios entre matching principal e diagnóstico.
- Não executar diagnóstico antes do matching principal.

// ajuste: prioridade matching
Prioridade obrigatória:
- O diagnóstico secundário (`nota_fiscal + placa_normalizada`) não pode ser executado antes do matching principal.
- O diagnóstico secundário não pode sobrescrever um match válido por chave.
- Se existir correspondência válida por chave, o status é obrigatoriamente `vinculado` e o diagnóstico secundário não deve ser executado.

## Regras do matching principal
// ajuste: correspondência válida
Definição formal de correspondência válida:
- Correspondência válida = registro complementar cuja `chave_normalizada` é exatamente igual à `chave_normalizada` do registro da Base.
- Nenhum outro campo participa da validação.
- Campos analíticos (peso, data, clifor etc.) não participam da validação.

- Matching sempre parte da Base (varredura por registros da Base).
- Complementar nunca cria vínculo sozinho.
- Com 1 correspondência válida por chave: status `vinculado`.
- Sem correspondência por chave: seguir para diagnóstico/aguardando.

// ajuste: ambiguidade multi-layout
- Com múltiplos layouts válidos para a mesma chave: status `ambiguo`.
Regra absoluta:
- Mesmo que os dados sejam idênticos entre layouts, o sistema não deve considerar correspondência única.
- Não existe consolidação automática entre layouts.

## Regras do diagnóstico secundário
Critério: `nota_fiscal + placa`.

Condições de execução:
- só executar com nota válida;
- só executar com placa válida (não nula, não vazia, com ao menos 1 caractere após normalização).

Regras:
- placa não faz parte da chave global;
- diagnóstico não altera a definição de chave.

Resultados do diagnóstico (quando executado):
- 1 candidato com contrato diferente: `divergente`;
- múltiplos candidatos: `ambiguo`;
- nenhum candidato: `aguardando`.

Se diagnóstico não for elegível (ex.: placa inválida/ausente):
- manter `aguardando`.

## Regras de origem
- 1 correspondência válida: `origem = nome do layout`.
- Ambiguidade: `origem = NULL`.
- Não existe layout preferido.
- Não existe priorização automática.

## Tabela de decisão final
| Situação | Status final |
| --- | --- |
| Match válido por chave | `vinculado` |
| Sem match por chave + diagnóstico não elegível ou sem candidato | `aguardando` |
| Sem match por chave + 1 candidato (nota+placa) com contrato diferente | `divergente` |
| Múltiplos candidatos no diagnóstico | `ambiguo` |
| Múltiplos layouts válidos para a mesma chave | `ambiguo` |

## Reprocessamento
Disparadores:
- importação com inserção/atualização de Base ou Complementar;
- alteração em campo relevante que possa afetar decisão.

Regras:
- reprocessar somente chaves afetadas;
- não manter status antigo após mudança relevante;
- alteração em `placa_normalizada` pode alterar resultado do diagnóstico secundário e deve disparar reprocessamento da chave.

// ajuste: consistência determinística
## Consistência determinística do resultado
A tabela `conferencia` deve sempre refletir exclusivamente o estado atual de:
- `registros_base`;
- `registros_complementares`.

Regras:
- Não existe estado intermediário persistido.
- Não existe dependência de ordem de execução.
- O mesmo conjunto de dados deve sempre produzir o mesmo resultado.

## Proibições do motor
- Não inferir dados.
- Não escolher “melhor match”.
- Não priorizar layouts.
- Não inferir correspondência por similaridade.
- Não usar placa como chave.
- Não usar peso, data ou qualquer campo analítico para decidir vínculo.
- Não consolidar dados de múltiplos layouts automaticamente.
- Não misturar matching principal com diagnóstico.
- Não manter status antigo após alteração relevante.

## Resultado esperado
- Comportamento previsível.
- Algoritmo auditável.
- Decisão reproduzível apenas com base em dados normalizados e regras fixas.
