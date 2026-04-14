# Análise 2 — Refino do mock conforme PRDs

## O que foi ajustado
- **Conferência**
  - Revisão de textos para posicionar a tela como módulo de **visualização de resultado**.
  - Inclusão de aviso curto indicando que a tela está em modo mock e não toma decisão de negócio.
  - Ajuste da legenda para reduzir ambiguidade sobre interpretação de status.
  - Manutenção de **Peso Fiscal** e **Peso Líquido** como colunas apenas informativas.

- **Mocks da conferência**
  - Ajuste das chaves mockadas para não sugerir uso incorreto de sufixo após hífen.
  - Revisão dos valores de origem para narrativa operacional mais realista (base + layout complementar).
  - Preservação do caráter mockado, sem mecanismo real de normalização ou matching.

- **Importação**
  - Reforço da separação entre etapa da **Base GRL053** e etapa de **Relatório Complementar**.
  - Inclusão de dependência visual entre seleção de layout complementar e ação de importar complementar.
  - Revisão do resumo mock com nomenclaturas mais operacionais.

- **Configurações / Layout Base / Complementares**
  - Ajuste de terminologia para aderência ao PRD do Layout Base:
    - Nome da Coluna Excel
    - Apelido
    - Tipo da Coluna
    - Participa da Análise
  - Revisão de cabeçalhos, placeholders e textos auxiliares da aba de layouts complementares para deixá-la com semântica de relatórios externos mapeados para o sistema.

- **Dashboard**
  - Ajuste de títulos e rótulos para coerência com os mocks atuais.
  - Manutenção da contagem de layouts complementares vinculada ao mock de configurações.

## Incoerências visuais corrigidas
- Chaves mockadas que podiam ensinar regra incorreta de contrato com hífen.
- Linguagem genérica em configurações, substituída por terminologia aderente aos PRDs.
- Fluxo de importação sem distinção clara entre base e complementar.
- Rótulos do dashboard com semântica mais próxima do produto em operação.

## Pontos alinhados aos PRDs
- Existência de **Base principal (GRL053)** e **Layouts Complementares** ficou explícita em múltiplas telas.
- Chave visual mockada aderente à ideia de contrato útil + nota fiscal, sem sufixo pós-hífen.
- Tela de conferência reforçada como exibição/consulta de resultado.
- Layouts complementares representados como mapeamentos de relatórios externos.

## O que permanece mockado
- Importação de arquivos (sem upload real/processamento real).
- Resultado exibido na conferência (sem matching real).
- Normalização de contrato (sem motor real; apenas exemplos visuais ajustados).
- Persistência de configurações e validações avançadas.

## O que foi deixado para a fase de lógica/backend
- Pipeline real de importação/parsing.
- Regra determinística real de normalização de contrato.
- Motor de vinculação entre base e complementares.
- Persistência de layouts e histórico de importações.
- Regras de validação e governança de dados.
