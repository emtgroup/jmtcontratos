

# Plano: CRUD Real para Configurações de Layout

## Diagnóstico

A tela `Configuracoes.tsx` importa `layoutBaseColumns` do mock (`src/data/mock.ts`) e usa `useState` puro. O "Salvar Mapeamento" só valida localmente e mostra feedback verde, mas não grava nada. As tabelas `layouts_base` e `layouts_base_colunas` **não existem** no banco.

## Etapa 1 — Criar tabelas no banco (migration)

### `layouts_base`
| Campo | Tipo |
|-------|------|
| id | uuid PK default gen_random_uuid() |
| nome | text not null default 'GRL053' |
| ativo | boolean not null default true |
| linha_cabecalho | int not null default 2 |
| linha_dados | int not null default 3 |
| created_at | timestamptz default now() |

### `layouts_base_colunas`
| Campo | Tipo |
|-------|------|
| id | uuid PK default gen_random_uuid() |
| layout_base_id | uuid FK → layouts_base(id) ON DELETE CASCADE |
| nome_coluna_excel | text not null |
| apelido | text default '' |
| tipo_coluna | text not null |
| analise | boolean default false |
| ordem | int default 0 |

### `layouts_complementares` e `layouts_complementares_colunas`
Mesma estrutura análoga (preparação, sem CRUD funcional nesta entrega).

RLS: permissiva (`true`) como as demais tabelas do sistema interno sem autenticação.

## Etapa 2 — Serviço de persistência

Criar `src/services/layoutBaseService.ts` com funções usando o Supabase client:
- `fetchLayoutBase()` — busca layout ativo + colunas
- `saveLayoutBase(layout, colunas)` — upsert layout + sync colunas (delete removidas, upsert existentes/novas)

## Etapa 3 — Ajustar `Configuracoes.tsx`

- Remover import de `layoutBaseColumns` do mock
- Carregar dados do banco via `useEffect` ao montar
- No "Salvar Mapeamento":
  1. Validar (contrato vinculado exato 1, nota fiscal exato 1, sem nome vazio, sem duplicata)
  2. Chamar `saveLayoutBase()`
  3. Se erro → toast de erro, sem feedback falso
  4. Se sucesso → recarregar do banco → toast de sucesso
- Persistir `linha_cabecalho` e `linha_dados`
- Manter toda a lógica visual existente (semântica de tipos, badges, tooltips)

## Etapa 4 — Relatório markdown

Arquivo `analise-8-crud-layout-base.md` documentando causa raiz, alterações e pendências.

## Fora de escopo
- CRUD funcional de layouts complementares (apenas tabelas criadas)
- Importação, matching, conferência — não tocados
- Redesign visual

## Arquivos alterados
- Migration SQL (4 tabelas)
- `src/services/layoutBaseService.ts` (novo)
- `src/pages/Configuracoes.tsx` (persistência real)
- `analise-8-crud-layout-base.md` (relatório)

