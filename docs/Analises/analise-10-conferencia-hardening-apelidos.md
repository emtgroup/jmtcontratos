# Análise 10 — Hardening da conferência após apelidos do layout base

## Riscos encontrados
1. Possibilidade de múltiplos `layouts_base` ativos, gerando seleção implícita e potencial inconsistência dos apelidos exibidos.
2. Leitura dinâmica de `dados_originais` por chave configurada no layout: quando a coluna não existe ou está mal mapeada, o valor pode vir nulo.
3. Apelidos curtos/débeis (ex.: `NF`, `12`) podem piorar a UX ao substituir labels padrão mais claros.

## Decisões de proteção aplicadas
- **Ativo único (base):**
  - Migração para normalizar legados e manter somente 1 layout base ativo.
  - Índice parcial único para impedir múltiplos ativos futuros.
  - `saveLayoutBase` desativa outros ativos antes de persistir o layout atual.
  - `/conferencia` mostra aviso quando detectar inconsistência de ativo no carregamento.
- **Fallback seguro em JSON dinâmico:**
  - View documentada com comentário de risco e `CASE` explícito para retornar `NULL` quando mapeamento/chave não existir.
  - Frontend mantém renderização defensiva para `—` quando campo vier nulo.
- **Validação simples de apelidos (UX):**
  - Só aceita apelido visual com critérios mínimos: não vazio, tamanho >= 3 e não numérico puro.
  - Caso inválido, aplica fallback padrão.

## Limitações mantidas (intencionais)
- Não houve alteração de matching/chave/status/processamento.
- Estrutura da grid permaneceu fixa (sem montagem dinâmica).
- Nenhum novo fluxo de tela ou arquitetura foi introduzido.
