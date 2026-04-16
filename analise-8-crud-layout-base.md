# Análise 8 — CRUD Real do Layout Base (GRL053)

## Data: 2026-04-16

## Diagnóstico (causa raiz)

A tela `Configuracoes.tsx` importava `layoutBaseColumns` de `src/data/mock.ts` e mantinha estado apenas via `useState`. O botão "Salvar Mapeamento" executava validação local e mostrava feedback verde, mas **nenhuma gravação ocorria**. Ao recarregar a página, os dados voltavam ao estado inicial do mock.

As tabelas `layouts_base` e `layouts_base_colunas` **não existiam** no banco.

## O que foi feito

### 1. Migration (4 tabelas)
- `layouts_base` — configuração do layout base com `linha_cabecalho`, `linha_dados`, `ativo`
- `layouts_base_colunas` — colunas mapeadas com `nome_coluna_excel`, `apelido`, `tipo_coluna`, `analise`, `ordem`
- `layouts_complementares` — preparação estrutural (sem CRUD funcional nesta entrega)
- `layouts_complementares_colunas` — preparação estrutural

RLS permissiva (`true`) em todas, alinhado ao padrão do sistema interno sem autenticação.

### 2. Serviço de persistência (`src/services/layoutBaseService.ts`)
- `fetchLayoutBase()` — busca layout ativo + colunas ordenadas
- `saveLayoutBase()` — upsert do layout + sincronização de colunas (insert/update/delete)
- Após salvar, recarrega do banco para garantir que o estado reflete a fonte da verdade

### 3. Ajuste de `Configuracoes.tsx`
- Removida dependência de `layoutBaseColumns` do mock
- Carregamento inicial via `useEffect` + `fetchLayoutBase()`
- Salvamento real via `saveLayoutBase()` com feedback correto (toast de erro ou sucesso)
- `linha_cabecalho` e `linha_dados` agora são controlados e persistidos
- Checkbox de análise agora é controlado (`checked` + `onCheckedChange`)
- Loading state e desabilitação de campos durante salvamento
- Estado vazio tratado (nenhuma coluna cadastrada)

### 4. Validações implementadas
- Exatamente 1 coluna do tipo "Contrato vinculado"
- Exatamente 1 coluna do tipo "Nota fiscal"
- Nenhum nome de coluna Excel vazio
- Nenhum nome de coluna Excel duplicado
- Salvamento bloqueado se qualquer validação falhar
- Toast de sucesso só após confirmação do banco

## O que ficou fora de escopo
- CRUD funcional de layouts complementares (tabelas criadas, tela ainda mock)
- Importação, matching, conferência — não tocados
- Redesign visual
- Testes automatizados
