# Análise 4 — Correção mínima do bug de importação complementar

## 1. Resumo da correção

Foi aplicada uma correção mínima e localizada no fluxo de importação complementar para:

- eliminar ambiguidade silenciosa na seleção de layout por nome;
- endurecer o fallback de coluna Excel para evitar interpretação indevida de cabeçalho textual;
- melhorar o diagnóstico estrutural quando o cabeçalho divergir do layout.

Sem alterar arquitetura, sem mexer no motor de matching e sem alterar PRDs.

---

## 2. Causa raiz confirmada

A causa raiz confirmada estava no parser/validador estrutural (`resolverIndices`) do frontend:

1. fallback de referência de coluna Excel permissivo demais (`^[A-Z]+$`), que podia interpretar texto como coluna;
2. erro estrutural sem diagnóstico completo (faltava visão consolidada de esperado/encontrado/ausente);
3. listagem de layouts complementares com deduplicação por nome, abrindo margem para ambiguidade operacional.

---

## 3. Arquivos alterados

- `src/services/importacaoBaseService.ts`
- `src/pages/Importacao.tsx`

---

## 4. Correção mínima aplicada

### 4.1 Parser/validador estrutural
No `resolverIndices`:

- fallback de coluna Excel restringido para padrão curto e explícito (`^[A-Z]{1,3}$`);
- validação passou a acumular colunas ausentes e emitir **erro estrutural único e detalhado** contendo:
  - `layout_id` usado;
  - `nome_layout`;
  - `linha_cabecalho`;
  - `colunas_esperadas`;
  - `colunas_encontradas`;
  - `colunas_ausentes`;
  - flag explícita de deduplicação por nome.

### 4.2 Seleção/resolução de layout complementar
Na listagem de layouts complementares ativos:

- removida deduplicação automática por nome;
- mantida listagem por registros reais ativos;
- adicionado `nome_exibicao` com nome + id curto para deixar claro qual layout está sendo selecionado.

### 4.3 Diagnóstico na tela de importação
Na tela `/importacao`:

- dropdown passou a exibir `nome_exibicao` (nome + id curto);
- após seleção, exibe explicitamente o `layout_complementar_id` completo usado no fluxo.

---

## 5. O que NÃO foi alterado

- **Não** foi alterado o motor de matching.
- **Não** foi alterada a lógica de `divergente` por `nota + placa`.
- **Não** houve mudança nas regras de conferência fora do escopo da validação estrutural.
- **Não** houve mudança na importação da Base além de utilitário compartilhado estritamente necessário no parser.
- **Não** houve alteração de PRDs.

---

## 6. Riscos remanescentes

- O parser continua estrito por projeto (conforme PRD): qualquer divergência real de cabeçalho seguirá gerando erro estrutural.
- Se houver múltiplos layouts ativos com nomes muito parecidos, a ambiguidade visual foi reduzida pelo ID explícito, mas a governança de cadastro ainda depende de disciplina operacional.
- Arquivos com aba válida fora da primeira planilha ainda podem exigir seleção correta de aba (não alterado nesta tarefa para manter escopo mínimo).

---

## 7. Como validar manualmente

Checklist mínimo:

1. Selecionar layout complementar desejado e conferir ID exibido na tela.
2. Importar arquivo com cabeçalho compatível com `nome_coluna_excel` do layout.
3. Confirmar que a validação passa e o fluxo segue para processamento.
4. Importar arquivo com cabeçalho incompatível.
5. Confirmar erro estrutural explícito com esperado x encontrado x ausente.
6. Confirmar no erro qual `layout_id` e `nome_layout` foram usados.
7. Confirmar que a Base não foi alterada indevidamente por esse cenário.
8. Confirmar que o comportamento de matching permaneceu inalterado nesta tarefa.
