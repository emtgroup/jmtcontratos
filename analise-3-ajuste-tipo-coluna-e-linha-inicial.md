# Análise 3 — ajuste de tipo da coluna e linha inicial

## O que foi alterado
- A tela **Configurações** (Layout Base e Layouts Complementares) foi ajustada para usar a semântica de negócio no campo de tipo da coluna.
- O rótulo da coluna foi alterado de **Tipo do Sistema** para **Tipo da Coluna**.
- Foram adicionados blocos visuais com campos mockados para:
  - **Linha inicial do cabeçalho**
  - **Linha inicial dos dados**
- Os textos de apoio foram refinados para indicar que:
  - o usuário define o significado das colunas;
  - o sistema usa esse mapeamento para interpretar o arquivo;
  - a leitura começa nas linhas configuradas;
  - a interface segue mockada, sem lógica real de importação.

## Por que `Tipo do Sistema` foi substituído
O termo anterior induzia uma leitura técnica (tipo de dado), enquanto o PRD define mapeamento por **significado de negócio da coluna**. Por isso, foi substituído por **Tipo da Coluna**, que representa melhor o comportamento esperado no sistema real.

## Novas opções de tipo adotadas
As opções técnicas anteriores foram removidas e substituídas pelas opções de negócio:
- Contrato vinculado
- Nota fiscal
- Placa
- Peso fiscal
- Peso líquido
- Data
- Clifor
- Outros

## Como foi representada a linha inicial de leitura
- No **Layout Base**, foi adicionado um bloco compacto acima da tabela principal com dois inputs numéricos mockados:
  - cabeçalho = `2`
  - dados = `3`
- Nos **Layouts Complementares**, o mesmo bloco foi adicionado na área de criação/edição do layout, também com os valores mockados `2` e `3`.

## O que continua mockado (backend futuro)
- Não há persistência das configurações.
- Não há parser real de arquivo.
- Não há motor de importação executando leitura com base nessas linhas.
- Não foi implementada validação complexa.
- Não houve alteração de backend, contratos de API ou fluxo real de processamento.
