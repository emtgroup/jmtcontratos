# Análise 7 — Backend Real da Importação Base via Lovable Cloud

## PRDs Lidos e Validados

1. ✅ `PRD — Sistema de Conferência de Contratos (V6).md`
2. ✅ `Mini PRD — Tela de Importação de Relatórios.txt`
3. ✅ `Mini PRD — Tela de Layout do Relatório Base (GRL053).txt`
4. ✅ `Mini PRD — Tela de Conferência de Contratos.txt`
5. ✅ `Mini PRD — Esquema de Dados do Sistema.txt`
6. ✅ `Mini PRD — Tela de Layouts Complementares.txt`

Todos os arquivos foram localizados em `/public` e lidos integralmente.

---

## Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| `src/components/ui/chart.tsx` | Corrigido erros de TypeScript com tipos do Recharts |
| `src/types/importacao.ts` | **Criado** — tipos da importação base |
| `src/services/importacaoBaseService.ts` | **Criado** — serviço de parsing Excel e chamada ao backend |
| `src/pages/Importacao.tsx` | **Reescrito** — substitui mock por importação real |
| `supabase/functions/importar-base/index.ts` | **Criado** — Edge Function de processamento |

---

## Tabelas Criadas no Lovable Cloud

### `importacoes`
Registro de auditoria. Campos: tipo, layout_id, nome_arquivo, total_linhas, inseridos, atualizados, ignorados, status, created_at.

### `registros_base`
Tabela operacional com chave única `chave_normalizada`. Campos: contrato_vinculado, nota_fiscal, placa_normalizada, dados_originais (JSONB), ultima_importacao_id, updated_at.

### `conferencia`
Resultado materializado. Campos: chave_normalizada (UNIQUE), status (aguardando/vinculado/divergente/ambiguo), origem.

### `import_lock`
Single-row lock para concorrência. Campos: locked, locked_at, importacao_id.

---

## Implementação da Chave

```
chave_normalizada = contrato_normalizado + "::" + nota_normalizada
```

- Separador `::` — não aparece em dados reais, evita colisão
- Determinística — mesma entrada sempre gera mesma chave
- Baseada no **tipo da coluna**, não no nome

---

## Normalização Aplicada

### Contrato vinculado
1. Remove caracteres não numéricos (exceto hífen)
2. Separa pelo primeiro hífen
3. Mantém apenas dígitos do primeiro bloco

Exemplos:
- `MTP 16876` → `16876`
- `AFX 33610-33316` → `33610`
- `17290-1` → `17290`

### Nota fiscal
- Remove todos os não-dígitos
- `000456` → `000456` (zeros preservados)

### Placa
- Maiúsculo, sem espaços, sem hífens
- `QAZ 2B-45` → `QAZ2B45`

---

## Comportamento Incremental

Para cada linha da importação:
1. **Chave não existe** → INSERT em `registros_base` + INSERT em `conferencia` (status: aguardando)
2. **Chave existe, dados diferentes** → UPDATE em `registros_base`
3. **Chave existe, dados iguais** → IGNORE (contabilizado como "ignorado")

Regras críticas respeitadas:
- Importação **não substitui** a base
- Importação **não remove** registros
- Ausência em nova carga **não significa exclusão**

---

## Concorrência

- Tabela `import_lock` com single row (id=1)
- Verificação antes de iniciar importação
- Lock adquirido no início, liberado no final (inclusive em caso de erro)
- Retorna HTTP 409 se já existe importação em andamento

---

## O Que Ficou Fora Desta Etapa

1. ❌ Importação complementar
2. ❌ Matching base + complementar (vinculado/divergente/ambíguo)
3. ❌ Diagnóstico secundário (nota + placa)
4. ❌ Layout base dinâmico (usando mapeamento fixo por enquanto)
5. ❌ Testes automatizados (ambiente Edge Function limita cobertura)
6. ❌ Reprocessamento automático de conferência
7. ❌ Botão de nova análise (limpeza)

---

## Pendências da Próxima Etapa

1. Importação complementar com regras do PRD
2. Matching automático após importação
3. Diagnóstico secundário (nota + placa)
4. Layout base dinâmico (ler de `layouts_base_colunas`)
5. Atualização da tela de conferência com dados reais do banco
6. Dashboard com dados reais
