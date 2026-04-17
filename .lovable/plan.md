
# Plano: Corrigir desalinhamento entre Configurações e Importação Base

## Diagnóstico (causa raiz)

O erro `Layout base inválido: tipo "contrato_vinculado" ausente` é real. Ele acontece porque há **dois desalinhamentos** entre o que `Configuracoes.tsx` salva e o que `importacaoBaseService.ts` espera:

### Bug 1 — `tipo_coluna`: caixa e formato diferentes

- **Tela salva**: `"Contrato vinculado"`, `"Nota fiscal"`, `"Placa"` (texto legível, com espaço e maiúscula — ver `tipoColunaOptions` linha 35–49 de Configuracoes.tsx).
- **Service compara com**: `"contrato_vinculado"`, `"nota_fiscal"`, `"placa"` (snake_case, linha 6–7 de `importacaoBaseService.ts`).
- **Resultado**: `contagem.get("contrato_vinculado")` retorna `0` → erro "ausente".

Confirmado no banco:
```
tipo_coluna = "Contrato vinculado"  ← gravado pela tela
tipo_coluna = "Nota fiscal"
tipo_coluna = "Placa"
```

### Bug 2 — `nome_coluna_excel`: nome de cabeçalho em vez de letra

- **Tela salva**: `"CONTR. CLIENTE"`, `"NOTA"`, `"PLACA"` (texto do cabeçalho da planilha).
- **Service espera**: `"A"`, `"B"`, `"D"` (letra Excel) e chama `letraParaIndice()` que **lança erro** se não for `[A-Z]+`.
- Mesmo se o Bug 1 fosse corrigido, o próximo erro seria: `Coluna "CONTR. CLIENTE" não é uma letra Excel válida`.

### Por que isso aconteceu

A entrega anterior assumiu que o usuário digitaria letras Excel (`A`, `B`, `C`). Mas a tela de Configurações sempre tratou esse campo como **nome da coluna do cabeçalho** (label exibido "Nome da Coluna no Excel", placeholder tipo "EMPRESA"). O usuário usou exatamente como a interface sugeria.

A interpretação correta, alinhada com o PRD ("workspace trabalha com campos lógicos mapeados a partir do cabeçalho"), é: o `nome_coluna_excel` é o **texto do cabeçalho** que deve ser localizado na linha de cabeçalho da planilha.

## Correção mínima e segura

Ajustar **apenas** `src/services/importacaoBaseService.ts`. Nenhuma migration, nenhuma alteração em Configurações, nenhum reset de dados.

### Mudança 1 — Normalizar `tipo_coluna` na comparação

Criar um helper `normalizaTipo(s)` que faz `s.trim().toLowerCase().replace(/\s+/g, "_")`.
- `"Contrato vinculado"` → `"contrato_vinculado"` ✓
- `"Nota fiscal"` → `"nota_fiscal"` ✓
- `"Placa"` → `"placa"` ✓
- `"contrato_vinculado"` (compatibilidade reversa) → `"contrato_vinculado"` ✓

Aplicar na hora de montar `contagem` e `indicePorTipo`. A constante `TIPOS_OBRIGATORIOS` já está em snake_case, mantém.

### Mudança 2 — Resolver coluna por nome de cabeçalho (não por letra)

Substituir `letraParaIndice(nome_coluna_excel)` por uma busca posicional:

1. Ler `headerRow` da planilha (linha `linha_cabecalho`).
2. Para cada coluna configurada, normalizar `nome_coluna_excel` (trim + uppercase + colapsar espaços) e procurar índice correspondente em `headerRow` normalizado igual.
3. Se não achar → erro claro: `Coluna "CONTR. CLIENTE" (contrato_vinculado) não encontrada no cabeçalho da linha X. Cabeçalhos disponíveis: [...]`.
4. **Compatibilidade reversa**: se `nome_coluna_excel` casar com `^[A-Z]+$` E não for encontrado como cabeçalho, tentar interpretar como letra Excel (preserva configurações antigas que usaram letras).

Isso exige reordenar o fluxo: ler o arquivo **primeiro**, depois resolver índices contra o header real (hoje resolve antes de abrir o arquivo). Mudança pequena.

### Mudança 3 — Mensagens de erro mais úteis

- "tipo X ausente" → listar tipos encontrados no layout para o usuário ver o que tem configurado.
- Manter erros brutos (sem mascarar).

## Fora de escopo

- Não alterar `Configuracoes.tsx` (a UX atual está correta e alinhada com PRD).
- Não alterar banco / migrations.
- Não tocar em complementares, matching, conferência, edge function de batching.
- Não alterar regras de negócio (chave continua `contrato_vinculado + nota_fiscal`).

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/services/importacaoBaseService.ts` | Normalização de `tipo_coluna` + resolução por header (com fallback para letra Excel) |

## Resultado esperado

- Importação do `GRL053 COOPERAGRO.xlsx` passa a funcionar com o layout atual configurado em /configuracoes (sem o usuário precisar reconfigurar nada).
- Erro fica explícito e útil quando cabeçalho não bate.
- Configurações antigas com letras Excel continuam funcionando (compat reversa).
