

# SICON | Contabilidade — Estrutura Frontend

## Visão Geral
Sistema interno de conferência de contratos agrícolas. Apenas UI com dados mockados, sem lógica de negócio. Visual corporativo baseado nas imagens de referência (header escuro, sidebar clara, cards com bordas coloridas).

## Design System
- **Header**: fundo escuro (#1B2A4A), texto branco, logo "SICON | CONTABILIDADE", info do usuário e base ativa (GRL053)
- **Sidebar**: fundo claro, menu com ícones, item ativo com fundo azul escuro e texto branco
- **Cards de status**: bordas coloridas à esquerda (verde=vinculado, amarelo=aguardando, vermelho=divergente, laranja=ambíguo)
- **Tipografia**: limpa, labels em uppercase, dados grandes em destaque
- **Cores dos status**: Verde (#22C55E), Amarelo (#EAB308), Vermelho (#EF4444), Laranja (#F97316)

## Estrutura de Páginas

### 1. Layout Global
- `AppLayout` com Sidebar + Header + conteúdo central
- Sidebar colapsável com: Dashboard, Importação, Conferência, Configurações (agrupa Layout Base e Complementares)
- Header fixo com título do sistema, usuário "Analista Fiscal", badge "Base GRL053"

### 2. Dashboard (`/`)
- Título "Visão Geral" com subtítulo
- 4 cards de resumo: Total Registros (6), Vinculados (3), Aguardando (1), Divergentes/Ambíguos (2)
- Tabela de "Conferência de Dados Normalizados" com busca, filtro e exportar
- Painel lateral "Regra de Ouro" e "Status do Sistema" (mockados)

### 3. Importação (`/importacao`)
- Título "Importação de Dados"
- Duas áreas de upload lado a lado: Base GRL053 e Complementar (com seleção de layout)
- Drag & drop + clique para importar
- Toast/banner de sucesso com resumo mockado

### 4. Conferência (`/conferencia`)
- Título "Módulo de Conferência"
- Filtro ativo (badge), busca, botões Filtrar e Exportar
- Tabela: Status (badge colorido), Chave Determinística, Contrato, Nota Fiscal, Placa, Valor
- 6 registros mockados com mix de status
- Legenda: Vínculo Direto / Diagnóstico Secundário

### 5. Configurações — Layout Base (`/configuracoes`)
- Tabs: "Layout Base (GRL053)" e "Layouts Complementares"
- Tab Base: tabela editável com Coluna Excel, Apelido, Tipo do Sistema (dropdown), Análise (checkbox)
- Botão "Salvar Configuração", "Adicionar Nova Coluna"
- Regras de integridade (info banner)

### 6. Configurações — Layouts Complementares
- Tab Complementares: lista de layouts com Nome, Colunas Mapeadas, Ações
- Estado vazio: "Nenhum layout complementar cadastrado"
- Botão "+ Novo Layout" → formulário inline com nome, tabela de colunas, validação visual de campos obrigatórios (Contrato Vinculado, Nota Fiscal)

## Componentes Compartilhados
- `StatusBadge` — badge colorido por status
- `DataTable` — tabela reutilizável com busca e filtros
- `UploadArea` — área de drag & drop
- `PageHeader` — título + subtítulo + ações

## Dados Mockados
- Arquivo `src/data/mock.ts` centralizado com registros, layouts e estatísticas

## Rotas
- `/` → Dashboard
- `/importacao` → Importação
- `/conferencia` → Conferência  
- `/configuracoes` → Configurações (Layout Base + Complementares via tabs)

