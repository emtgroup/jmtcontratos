

# Plano: CRUD Real dos Layouts Complementares

## Diagnóstico

A aba "Layouts Complementares" em `Configuracoes.tsx` é **100% mock**:
- Importa `layoutsComplementares` de `src/data/mock.ts` (linha 12)
- O formulário de novo layout não vincula inputs a estado (linhas 492-493 usam `<Input>` sem `value`/`onChange`)
- Não existe serviço de persistência para complementares
- O botão "Salvar Layout" não faz nada
- Não há carregamento do banco, não há exclusão real

As tabelas `layouts_complementares` e `layouts_complementares_colunas` já existem no banco (com FK cascade), mas estão vazias e sem uso.

## Etapa 1 — Criar serviço de persistência

Criar `src/services/layoutComplementarService.ts` espelhando o padrão do `layoutBaseService.ts`:

- `fetchLayoutsComplementares()` — busca todos os layouts ativos + colunas de cada um
- `saveLayoutComplementar(layout, colunas)` — upsert layout + sincronização de colunas (mesmo padrão: buscar IDs atuais, deletar removidos, insert/update restantes, recarregar do banco)
- `deleteLayoutComplementar(id)` — deleta o layout (FK cascade remove colunas automaticamente)

Diferenças em relação ao base:
- Pode existir N layouts complementares (não apenas 1)
- Nome do layout é obrigatório e editável
- Cada layout tem seus próprios `linha_cabecalho` e `linha_dados`

## Etapa 2 — Reescrever a aba complementar em `Configuracoes.tsx`

Substituir toda a seção mock (linhas 431-535) por implementação real:

**Estado:**
- `complementares: LayoutComplementarCompleto[]` — lista carregada do banco
- `editingLayout: { layout, colunas } | null` — layout em edição/criação
- `isSavingComplementar`, `isDeletingId`

**Carregamento:**
- `useEffect` busca todos os layouts complementares do banco ao montar (junto com o base)

**Lista de layouts existentes:**
- Tabela com Nome, Qtd Colunas, Ações (Editar / Excluir)
- Editar abre o formulário preenchido
- Excluir chama `deleteLayoutComplementar` e recarrega

**Formulário (criar/editar):**
- Nome do layout (obrigatório)
- Linha cabeçalho / linha dados
- Tabela de colunas com inputs vinculados a estado (nome Excel, apelido, tipo, análise)
- Botões: Adicionar Coluna, Salvar, Cancelar
- Mesmas validações do base: exatamente 1 "Contrato vinculado", 1 "Nota fiscal", sem nome vazio, sem duplicata

**Salvamento:**
- Validar antes
- Chamar `saveLayoutComplementar()`
- Erro → toast de erro
- Sucesso → recarregar lista do banco → toast de sucesso → fechar formulário

## Etapa 3 — Remover dependência de mock

- Remover import de `layoutsComplementares` do `Configuracoes.tsx`
- No `Dashboard.tsx`, substituir contagem mock por dado real (ou manter mock apenas lá, pois Dashboard está fora de escopo — decisão: manter mock no Dashboard por ora, não alterar outras telas)

## Etapa 4 — Validar consistência com Layout Base

Garantir que o serviço complementar segue exatamente o mesmo padrão:
- Mesmo fluxo de sync de colunas (buscar IDs → deletar removidos → upsert restantes → recarregar)
- Mesmas validações
- Mesmo comportamento de recarregamento pós-save
- Mesmos feedbacks de toast

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/services/layoutComplementarService.ts` | Novo — CRUD completo |
| `src/pages/Configuracoes.tsx` | Reescrever aba complementar com persistência real |

## Fora de escopo
- Dashboard (mantém mock)
- Importação, conferência, matching
- Modal de confirmação de exclusão (UX futuro)
- Refatoração do layout base (já funcional)

