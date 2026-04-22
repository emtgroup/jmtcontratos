# 1. Resumo executivo

A tela `/conferencia` já cumpre uma parte crítica do PRD: lê um dataset único materializado no backend (`vw_conferencia_tela`) e não executa matching no frontend. Porém, para uso operacional diário, ela ainda está em estágio básico: não traz contadores por status, não tem paginação explícita, limita a carga a 2000 linhas sem visibilidade de truncamento, e oferece pouco contexto para investigação de casos `aguardando`, `divergente` e `ambiguo`.

Em síntese: **a base arquitetural está correta**, mas a experiência operacional ainda não está. O menor caminho seguro para profissionalizar a tela é: (1) adicionar leitura resumida por status no topo; (2) explicitar paginação servidor+cliente; (3) enriquecer a grid com poucas colunas de investigação vindas do backend; (4) incluir detalhe por linha (drawer) apenas para leitura diagnóstica, sem lógica nova no frontend.

---

# 2. Aderência aos PRDs

## 2.1 O que está correto

- **Fonte única para a tela**: `/conferencia` consulta `vw_conferencia_tela` em uma única query, sem composição semântica local. Isso está aderente à regra de “conferência como fonte única para visualização”.
- **Sem recalcular matching/diagnóstico no frontend**: a tela valida apenas enum de status e renderiza; não tenta decidir status com peso/placa/etc.
- **Status suportados do PRD**: `vinculado`, `aguardando`, `divergente`, `ambiguo` estão no filtro e no badge.
- **Atualização manual segura**: botão “Atualizar” apenas refaz leitura do consolidado, sem acionar reprocessamento.

## 2.2 O que está incompleto

- **Filtros mínimos sem contagem operacional**: existem os filtros obrigatórios, mas sem números por status, o que reduz leitura rápida.
- **Leitura operacional pouco confiável em volume**: query fixa com `limit(2000)` sem informar que pode haver truncamento.
- **Diagnóstico visual insuficiente**: não há campo de “motivo do status” nem sinais de elegibilidade de diagnóstico secundário.

## 2.3 O que está desalinhado

- **Coerência funcional de status no ecossistema**: apesar da tela suportar `divergente`, o fluxo backend atual de conferência (especialmente importação complementar) não materializa `divergente` e ignora diagnóstico `nota+placa`; isso cria desalinhamento prático entre PRD e operação real.
- **“Diagnóstico operacional claro” (resultado esperado do Mini PRD da tela)** ainda não é atendido pela UX atual, porque a grid não explica por que o status foi atribuído.

---

# 3. Problemas encontrados (priorizados)

## Alta prioridade

1. **Ausência de contadores por status na própria tela** (sem visão imediata da distribuição operacional).
2. **Carregamento sem paginação explícita** com limite técnico oculto (2000), potencialmente omitindo registros.
3. **Tabela sem contexto de investigação**: mostra só chave/contrato/nota/status/origem.
4. **Sem explicação de status** para `aguardando`, `divergente`, `ambiguo`.

## Média prioridade

5. **“Chave técnica” ocupa espaço de destaque, mas tem baixa utilidade para o operador final** no fluxo diário.
6. **Busca limitada (contrato/nota) sem suporte a placa/origem/status textual**.
7. **Exportar desabilitado sem feedback de escopo** (não impede operação, mas transmite incompletude).

## Baixa prioridade

8. **Sem persistência de estado de filtro/consulta na URL** (impacta colaboração e retomada).
9. **Sem metadados de atualização** (último refresh/última importação visível na tela).

---

# 4. Análise de UX e operação

A tela atual funciona como “listagem técnica”, não como “painel de conferência”.

### Por que é insuficiente operacionalmente

- Operação de conferência normalmente começa por **“onde está o problema?”** (quantos aguardando/divergente/ambíguo) e não por leitura linha a linha.
- Sem contadores e sem razão do status, o usuário precisa “adivinhar” o que investigar primeiro.
- Ausência de paginação previsível gera insegurança: operador não sabe se está vendo tudo ou um recorte.
- Colunas atuais não oferecem **contexto mínimo** (placa, pesos, data, indicador de ausência complementar, motivo).

### Efeito colateral

Mesmo com backend correto, a UX transmite baixa maturidade porque:
- não prioriza exceções;
- não facilita triagem;
- não cria trilha clara de investigação.

---

# 5. Recomendação para KPIs/filtros

## Recomendação: **combinação de KPI + filtros com badge de contagem**

### Estrutura sugerida

- **Topo (cards compactos)**:
  - Total exibido
  - Vinculados
  - Aguardando
  - Divergentes
  - Ambíguos
- **Linha de filtros**:
  - Botões de status existentes, mas com contagem no próprio botão.

### Justificativa

- **Leitura rápida**: cards dão visão macro em 2–3 segundos.
- **Baixo ruído**: filtros com número evitam duplicidade cognitiva ao aplicar segmentação.
- **Profissionalismo**: padrão comum em telas operacionais maduras.
- **Simplicidade**: pode usar contagem da própria `conferencia` (sem regra nova no frontend).

### Regra importante

- KPI deve refletir **mesmo universo da listagem** (se houver filtro de busca global, decidir explicitamente se KPI é global ou filtrado; preferível global com rótulo claro “estado consolidado”).

---

# 6. Recomendação para paginação/performance

## Opção recomendada: **paginação tradicional server-side** (com tamanho de página configurável simples)

### Por que essa opção

- **Previsibilidade operacional**: usuário sabe página atual, total e consegue voltar em auditoria.
- **Performance controlada**: evita carregar blocos grandes e evita limite invisível de 2000.
- **Simplicidade de implementação**: Supabase suporta `range()`/contagem; baixo risco.

### Por que NÃO virtualização/infinite scroll agora

- **Virtualização**: útil para grids enormes e altamente densas; adiciona complexidade sem necessidade comprovada no estágio atual.
- **Infinite scroll**: pior para conferência operacional/auditável (perde noção de posição e dificulta revisão sistemática).

### Configuração mínima sugerida

- Página inicial: 50 linhas.
- Opções: 25 / 50 / 100.
- Mostrar: “Exibindo X–Y de Z”.
- Sempre ordenar por `updated_at desc` (ou outra ordem oficial definida).

---

# 7. Estrutura recomendada da tabela

Objetivo: adicionar contexto sem virar tela “pesada”.

## Colunas mínimas recomendadas

1. **Status** (badge)
2. **Motivo do status** (texto curto padronizado do backend)
3. **Contrato**
4. **Nota fiscal**
5. **Origem** (layout, quando aplicável)
6. **Placa (base)**
7. **Peso fiscal / peso líquido** (quando disponível na base, apenas informativo)
8. **Data da nota** (quando disponível)
9. **Atualizado em** (timestamp curto)

## Colunas que devem sair do destaque

- **Chave técnica**: manter em detalhe (drawer/tooltip/cópia), não como coluna principal de operação.

## Detalhe por linha (recomendado)

- **Linha clicável abre drawer de detalhes somente leitura** com:
  - chave normalizada;
  - indicadores de diagnóstico (ex.: sem complementar, múltiplos layouts, etc.);
  - comparação básica de campos relevantes (quando já existir dado materializado).

Sem edição. Sem lógica de decisão no frontend.

---

# 8. Fronteira entre conferência e ignorados

## O que pertence à `/conferencia`

- Registros **materializados em `conferencia`** (universo com base válida).
- Status final e origem final.
- Contexto para investigar o resultado desse status.

## O que NÃO pertence à `/conferencia`

- Linhas ignoradas na importação por **`ignorado_sem_base`**, **`ignorado_sem_alteracao`**, **`erro_normalizacao`** como lista operacional misturada na mesma grid.
- Detalhes brutos de parsing/erro de arquivo.

## Onde tratar ignorados

- **Resumo de importação** (já existe parcialmente) para totais.
- **Detalhamento consultável separado** (modal, aba de auditoria ou tela própria futura) ligado à importação, não à conferência.

Regra de fronteira: `conferencia` = resultado consolidado por chave válida; log de importação = telemetria e não-processados.

---

# 9. Proposta mínima de evolução (ordem sugerida)

## Fase 1 — ganho operacional imediato (baixo risco)

1. Adicionar contadores por status (cards + badge nos filtros).
2. Implementar paginação server-side com total.
3. Exibir metadado de recorte (“X–Y de Z”) e último refresh.

## Fase 2 — clareza diagnóstica (sem refatorar arquitetura)

4. Enriquecer dataset da view de conferência com campos informativos já existentes em base/complementar materializados no backend.
5. Incluir coluna “motivo do status” (materializada no backend, não inferida na UI).

## Fase 3 — investigação assistida

6. Adicionar drawer de detalhe read-only por linha para reduzir poluição da grid.

---

# 10. Riscos de implementação

1. **Quebra de aderência ao PRD se frontend começar a inferir diagnóstico**.
2. **Contagens inconsistentes** se KPI e grid usarem universos diferentes sem indicação.
3. **Paginação incorreta** (saltos/duplicações) se ordenação não for estável.
4. **Confusão conceitual** se misturar “ignorado da importação” dentro da conferência.
5. **Sobrecarga visual** se adicionar muitas colunas sem hierarquia (grid vira “planilha bruta”).
6. **Risco de regressão de performance** se tentar resolver via query client-heavy ao invés de materializar no backend.

---

## Conclusão prática

A menor evolução segura para tornar a tela `/conferencia` profissional é:
- manter fonte única;
- agregar visão de estado (KPIs + contagens nos filtros);
- tornar carregamento previsível (paginação server-side);
- acrescentar contexto diagnóstico mínimo (motivo, placa, pesos/data quando disponíveis);
- separar claramente conferência (resultado) de ignorados (auditoria de importação).

Isso entrega utilidade operacional real sem alterar arquitetura, sem regra nova no frontend e sem desviar dos PRDs.
