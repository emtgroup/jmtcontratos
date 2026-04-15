

# Plano: Backend Real da Importação Base (GRL053) via Lovable Cloud

## Resumo

Implementar a importação base com persistência real no Supabase (Lovable Cloud), substituindo completamente o fluxo mock atual. Inclui criação de tabelas, Edge Function para processamento, e ajuste do frontend.

---

## Pré-requisitos

O projeto **não possui Supabase conectado**. Será necessário habilitar o Lovable Cloud antes de implementar. Isso cria automaticamente o projeto Supabase e disponibiliza o client.

---

## Etapa 1 — Corrigir erro de build existente

O arquivo `src/components/ui/chart.tsx` tem erros de TypeScript com tipos do Recharts. Corrigir com type assertions para desbloquear o build.

---

## Etapa 2 — Habilitar Lovable Cloud e configurar Supabase

- Conectar Lovable Cloud (Database)
- Criar o client Supabase em `src/integrations/supabase/client.ts`

---

## Etapa 3 — Criar tabelas no banco (migrations)

### 3.1 `importacoes`
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| tipo | text ('base' / 'complementar') |
| layout_id | uuid nullable |
| nome_arquivo | text |
| total_linhas | int |
| inseridos | int |
| atualizados | int |
| ignorados | int |
| created_at | timestamptz |

### 3.2 `registros_base`
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| chave_normalizada | text UNIQUE |
| contrato_vinculado | text |
| nota_fiscal | text |
| placa_normalizada | text nullable |
| dados_originais | jsonb |
| ultima_importacao_id | uuid FK → importacoes |
| updated_at | timestamptz |

### 3.3 `conferencia`
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| chave_normalizada | text UNIQUE |
| status | text ('vinculado','aguardando','divergente','ambiguo') |
| origem | text nullable |

### 3.4 RLS
- Desabilitar RLS inicialmente (sistema interno sem autenticação por enquanto)

---

## Etapa 4 — Edge Function: `importar-base`

Endpoint que recebe o arquivo Excel parseado (JSON) e executa:

1. Registrar importação em `importacoes` (lock via flag — rejeitar se já em andamento)
2. Para cada linha:
   - Aplicar normalização (contrato: primeiro bloco numérico antes do hífen; nota: só números; placa: upper, sem espaço/hífen)
   - Gerar `chave_normalizada` = `{contrato}::{nota}` (separador `::` evita colisão)
   - Upsert incremental em `registros_base`:
     - Não existe → INSERT
     - Existe com dados diferentes → UPDATE
     - Existe igual → IGNORE
   - Upsert em `conferencia` com status `aguardando`
3. Atualizar `importacoes` com contadores finais
4. Retornar resumo

### Concorrência
- Usar uma tabela auxiliar `import_lock` (ou advisory lock via pg) para garantir 1 importação por vez

---

## Etapa 5 — Serviço frontend: `importacaoBaseService.ts`

- Ler arquivo Excel no browser com `xlsx` (SheetJS)
- Aplicar layout base (buscar mapeamento de colunas da configuração)
- Enviar dados parseados para a Edge Function
- Receber e exibir resumo real

---

## Etapa 6 — Ajustar `Importacao.tsx`

- Substituir o fluxo mock por chamada real ao serviço
- Adicionar estados de loading e erro
- Exibir resumo real retornado pela Edge Function
- Bloquear UI durante importação (concorrência)

---

## Etapa 7 — Tipos TypeScript: `src/types/importacao.ts`

Criar interfaces alinhadas ao PRD:
- `ImportacaoRecord`, `RegistroBase`, `ConferenciaRecord`
- `ResumoImportacao` (inseridos, atualizados, ignorados, total)

---

## Etapa 8 — Relatório markdown

Criar `analise-7-backend-importacao-base-lovable-cloud.md` documentando:
- PRDs lidos e validados
- Tabelas criadas
- Lógica de chave e normalização
- Comportamento incremental
- O que ficou fora de escopo

---

## Fora de escopo (conforme solicitação)

- Importação complementar
- Matching base + complementar
- Diagnóstico secundário (nota + placa)
- Testes automatizados (serão criados junto com a Edge Function mas limitados ao que o ambiente permite)
- Redesign de frontend

---

## Detalhes técnicos

- **Separador de chave**: `::` (duplo dois-pontos) — não aparece em contratos nem notas, evita colisão
- **Normalização de contrato**: regex `/^(\d+)/` após remover não-numéricos exceto hífen, pegar primeiro grupo antes do hífen
- **Parsing Excel**: biblioteca `xlsx` (SheetJS) no frontend, envio de JSON para Edge Function
- **Lock de concorrência**: tabela `import_lock` com single row + timestamp, verificada no início da Edge Function

