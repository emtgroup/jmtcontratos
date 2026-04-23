# PRD — Tela de Conferência

## 1. Objetivo da tela
A tela `/conferencia` deve permitir operação diária de conferência com três capacidades centrais:
- identificar rapidamente o que está resolvido e o que exige ação;
- entender o motivo do status de cada linha;
- priorizar investigação sem recalcular regra de negócio no frontend.

## 2. Filosofia
> A tela não decide.
> A tela alerta.
> A tela guia a investigação.

## 3. KPIs obrigatórios
No topo da tela, exibir os indicadores:
- Total
- Vinculados
- Aguardando
- Divergente
- Ambíguo

Regras:
- fonte dos números: dataset de conferência consumido do backend;
- mesmo universo da listagem ativa (busca aplicada), para manter coerência visual;
- sem cálculo semântico de status no frontend.

## 4. Filtros
Filtros obrigatórios com contagem:
- Todos (X)
- Vinculado (X)
- Aguardando (X)
- Divergente (X)
- Ambíguo (X)

Regras:
- seleção de filtro deve reiniciar para página 1;
- contadores devem permanecer coerentes com o universo ativo da tela.

## 5. Paginação
Obrigatório:
- paginação server-side;
- opções de tamanho: 25 / 50 / 100;
- exibir: “Exibindo X–Y de Z”;
- ordenação padrão: `updated_at desc`.

Proibido:
- infinite scroll.

## 6. Estrutura da tabela
Colunas mínimas:
- Status
- Contrato vinculado
- Nota fiscal
- Clifor
- Origem
- Placa
- Data da base
- Atualizado em

Regra:
- motivo do status deixa de ser obrigatório na grid principal;
- chave técnica não deve ser coluna principal da grid.
- chave técnica pode existir no detalhe da linha.
- a estrutura da grid é fixa (não é montagem dinâmica por layout).

## 6.1 Nomenclatura visual baseada no layout base (GRL053)
- Para campos originados da Base, a UI deve usar o `apelido` da coluna do layout base ativo quando existir.
- Se o `apelido` estiver vazio/ausente, usar rótulo padrão do sistema (fallback seguro).
- O `apelido` é **somente visual** e nunca altera:
  - matching
  - chave
  - processamento
  - persistência
  - regras de backend
- É obrigatório reduzir ambiguidade entre `contrato_vinculado` (chave operacional) e `contrato_interno` (contexto analítico).

## 7. Motivo do status (crítico)
O `motivo_status` é obrigatório no drawer (detalhe da linha), com exibição read-only.

Regras:
- no drawer, exibir exatamente o valor retornado pelo backend para `motivo_status`;
- quando `motivo_status` vier vazio/ausente, exibir `—`;
- não inferir motivo no frontend.

Na grid principal:
- a coluna pode ser omitida completamente (padrão atual), ou
- futuramente pode exibir apenas indicador leve (tooltip ou badge), sem substituir o drawer.

Diretriz de UX:
> O motivo do status é um dado de investigação, não de leitura massiva.
> Deve ser priorizado no drawer e não na grid principal.

## 8. Interação
- linha da tabela deve ser clicável;
- abrir drawer read-only com contexto da linha.

Conteúdo mínimo do drawer:
- dados base disponíveis na visão atual;
- dados complementar disponíveis na visão atual;
- motivo do status;
- contexto operacional.
- O drawer deve usar a mesma semântica visual dos apelidos da Base.
- Exibir explicitamente, quando disponível: contrato vinculado, contrato interno, nota fiscal, clifor, placa, data da base e chave técnica (secundária).
- O drawer deve exibir um bloco fixo mínimo + bloco de campos adicionais da Base marcados com `exibir_no_drawer` no layout base.
- Campos adicionais marcados e sem valor devem aparecer como `—` para manter consistência visual.
- `exibir_no_drawer` não altera grid principal, matching, status, chave, persistência ou importação.

## 9. Fronteira com importação
Não mostrar registros ignorados na grid de conferência.

Regra:
- ignorados pertencem ao resumo/auditoria de importação, não ao resultado operacional de conferência.

## 10. Resultado esperado
A tela deve responder objetivamente:
- o que está resolvido;
- o que precisa investigação imediata;
- por que cada item está no status atual.

Critérios de sucesso:
- leitura rápida;
- priorização clara;
- investigação facilitada;
- experiência profissional e previsível.
- campos analíticos (clifor, data, peso, contrato interno) podem enriquecer investigação, sem alterar status.
