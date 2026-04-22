# Análise 3 — Bug de importação do relatório complementar

## 1. Resumo executivo

- **Sintoma**: a importação complementar falha com erro estrutural de coluna ausente, mesmo com layout complementar previamente configurado.
- **Etapa onde quebra**: o fluxo quebra **antes do backend de importação**, na etapa de **leitura/validação estrutural do Excel no frontend** (`parseExcelFile` → `resolverIndices`).
- **Causa raiz identificada no código**: o parser exige que cada `nome_coluna_excel` do layout complementar selecionado exista no cabeçalho da linha configurada. Se não existir (ou se o layout selecionado tiver mapeamento diferente do arquivo), a importação é abortada com erro explícito. Não há evidência de uso de nomes hardcoded da Base dentro do fluxo complementar.
- **Impacto funcional**: o usuário não consegue chegar à persistência de `registros_complementares`; o backend `importar-complementar` nem é acionado quando a validação estrutural falha.

---

## 2. Fluxo real encontrado no código (pipeline completo)

### 2.1 Seleção do layout complementar na tela
1. A tela de importação carrega layouts complementares ativos via `listarLayoutsComplementaresAtivos()`.
2. O `Select` grava no estado `layoutComplementarId` o **ID** do layout (não o nome).

### 2.2 Envio do arquivo e layout selecionado
3. Ao clicar em importar complementar, `handleImportComplementar` chama `importarComplementar(arquivo, layoutComplementarId, ...)`.
4. `importarComplementar` carrega o layout complementar por ID (`carregarLayoutComplementarAtivo`).

### 2.3 Leitura do Excel
5. `parseExcelFile` lê a planilha com `XLSX` e usa a primeira aba do arquivo (`SheetNames[0]`).
6. O cabeçalho é lido na linha `layout.linhaCabecalho`.
7. Os dados começam em `layout.linhaDados`.

### 2.4 Identificação da linha de cabeçalho e validação estrutural
8. `resolverIndices` resolve os índices de colunas com base em `layout.colunas`:
   - procura por `nome_coluna_excel` no cabeçalho da linha configurada;
   - fallback para letra Excel (`A`, `B`, `AA`, ...) quando o valor parece letra.
9. Se qualquer coluna configurada não for encontrada, lança erro estrutural explícito e interrompe o fluxo.

### 2.5 Resolução das colunas por layout
10. O mapeamento no complementar vem de `layouts_complementares` + `layouts_complementares_colunas`, com `tipo_coluna` normalizado (ex.: `Contrato vinculado` → `contrato_vinculado`).
11. A validação exige presença única de `contrato_vinculado` e `nota_fiscal` no layout complementar.

### 2.6 Normalização, chave, persistência e matching
12. Se o parse passar, somente então o frontend envia `linhas` para a edge function `importar-complementar`.
13. No backend, ocorre normalização (`contrato`, `nota`, `placa`), geração de chave (`contrato::nota`), filtro obrigatório por existência na Base, persistência incremental em `registros_complementares` e recálculo de `conferencia` para chaves afetadas.

**Conclusão do pipeline**: o bug atual reportado (erro de coluna ausente) acontece no estágio **3–6 do pipeline**, isto é, parse/validação estrutural, antes da persistência.

---

## 3. Causa raiz

### 3.1 Causa raiz objetiva

A falha ocorre porque o parser complementar valida a estrutura por **correspondência estrita** entre os cabeçalhos lidos na linha configurada e os `nome_coluna_excel` salvos para o `layout_complementar_id` selecionado. Quando há divergência, ele aborta com erro.

Em termos práticos: o sistema não está “adivinhando” colunas; ele está aplicando o layout carregado. Se o layout persistido para aquele ID não corresponde ao arquivo atual, o erro é inevitável e ocorre antes do backend.

### 3.2 Pontos do código que materializam essa causa

- `importarComplementar` carrega layout por ID e chama `parseExcelFile`.
- `parseExcelFile` usa `linha_cabecalho` e `linha_dados` do layout complementar.
- `resolverIndices` procura por `nome_coluna_excel` e dispara erro quando não encontra.

### 3.3 Observações de risco associadas à causa

- Existe deduplicação por nome na listagem de layouts ativos (mantendo o mais recente por nome), o que pode esconder inconsistências históricas de configurações com nomes semelhantes.
- O parser usa a **primeira aba** do Excel sempre; se o cabeçalho correto estiver em outra aba, a validação estrutural falhará mesmo com layout correto.

---

## 4. Divergências entre código e PRD

## 4.1 Aderente aos PRDs

- Complementar exige layout selecionado e carrega colunas de `layouts_complementares_colunas`.
- Chave operacional é construída por contrato + nota no backend.
- Complementar sem base é ignorado (`ignorado_sem_base`) e não cria Base.
- Erro estrutural de cabeçalho divergente é explícito.
- Conferência é recalculada no backend; frontend não executa matching.

## 4.2 Desalinhamentos relevantes com PRD atualizado

1. **Matching/diagnóstico incompleto no fluxo complementar**: no recálculo da conferência do `importar-complementar`, o status é decidido apenas por contagem de layouts por chave (aguardando/vinculado/ambiguo), sem diagnóstico secundário `nota+placa` e sem produzir `divergente` nesse fluxo.
2. **Motor de matching simplificado no complementar**: a implementação não segue integralmente a ordem e regras do PRD do motor para cenários sem match principal (especialmente `divergente`).

> Importante: isso é divergência funcional real em relação ao PRD, mas **não é a causa do erro estrutural de coluna ausente** (que ocorre antes).

## 4.3 Trechos ambíguos/perigosos

- Fallback de coluna por “letra Excel” para qualquer texto só com letras (`^[A-Z]+$`) pode interpretar palavras como referência de coluna, gerando comportamento inesperado em alguns layouts.
- Deduplicação por nome na listagem pode mascarar cenários de configuração ambígua quando existem layouts semanticamente duplicados.

---

## 5. Hipóteses descartadas

1. **“Fluxo complementar está usando hardcode da Base (ex.: `CONTR. CLIENTE`)”**: não há hardcode desses nomes no parser complementar.
2. **“Backend está exigindo coluna da Base no complementar”**: o erro de coluna ausente nasce no frontend/parser, antes da chamada da edge function.
3. **“Frontend faz matching/conferência local”**: não faz; o frontend apenas parseia e envia, e a conferência vem do backend.
4. **“Layout complementar ignora linha de cabeçalho configurada”**: não ignorada; `linha_cabecalho` e `linha_dados` são aplicadas explicitamente.

---

## 6. Correção mínima recomendada (sem implementar agora)

1. **Correção mínima principal**: adicionar verificação pré-importação (diagnóstico técnico) exibindo ao usuário:
   - `layout_complementar_id` efetivamente usado,
   - `linha_cabecalho` aplicada,
   - lista de colunas esperadas (`nome_coluna_excel`) e cabeçalhos encontrados.
   
   Isso reduz ambiguidade operacional e permite identificar imediatamente se o mapeamento persistido diverge do arquivo.

2. **Correção mínima de robustez**: limitar o fallback de “letra Excel” apenas a padrões curtos (ex.: 1–3 letras) para evitar interpretar textos completos como referência de coluna.

3. **Correção mínima de governança de layout**: remover ambiguidade de layout por nome na seleção da importação (exibir nome + timestamp/ID ou endurecer unicidade lógica), sem redesign de arquitetura.

---

## 7. Riscos da correção

- Ajustar fallback de letra pode impactar usuários que realmente usam referência por letra em formatos não convencionais.
- Alterar estratégia de listagem de layout pode mudar qual configuração aparece primeiro para usuários já habituados ao comportamento atual.
- Qualquer ajuste no parser precisa manter a regra de erro estrutural explícito quando layout e cabeçalho divergem.

---

## 8. Checklist para implementação posterior

- [ ] Confirmar, em ambiente real, o `layout_complementar_id` usado na importação problemática.
- [ ] Comparar colunas salvas (`layouts_complementares_colunas`) com cabeçalho real da planilha (linha configurada).
- [ ] Manter validação estrutural explícita (sem fallback silencioso de mapeamento).
- [ ] Garantir que o fluxo complementar continue independente de nomes da Base.
- [ ] Preservar regra: complementar sem base não persiste operacionalmente.
- [ ] Após correção do parser, validar idempotência e reprocessamento normal.
- [ ] Tratar (em etapa separada) divergência do motor complementar para status `divergente` conforme PRD.

---

## Diagnóstico final (chat-ready)

### Diagnóstico
O bug de “coluna ausente” da importação complementar acontece no **parser do frontend**, na validação estrutural que compara `nome_coluna_excel` do layout complementar selecionado com o cabeçalho real da planilha na linha configurada. A falha ocorre antes do backend.

### Risco
Se corrigir sem cuidado, pode-se mascarar erro estrutural real (violando PRD) ou criar ambiguidade ao aceitar cabeçalhos errados. Há também risco de manter inconsistência por layouts semanticamente duplicados.

### Sugestão
Fazer correção mínima com diagnóstico pré-importação (layout ID + cabeçalhos esperados vs encontrados), endurecer fallback de letra Excel e reduzir ambiguidade de seleção de layout por nome.
