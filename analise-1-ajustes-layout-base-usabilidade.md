# Análise 1 — Ajustes de usabilidade no Layout Base (GRL053)

## Arquivos alterados
- `src/pages/Configuracoes.tsx`

## Diagnóstico curto do problema
- O campo **Nome da Coluna Excel** estava com largura reduzida (`w-20`), dificultando leitura e edição.
- O campo **Apelido** não tinha sugestão automática baseada no nome da coluna Excel, exigindo preenchimento repetitivo.
- O seletor de tipo não exibia explicitamente o tipo **Nome cooperativa**, o que gerava ambiguidade para mapear a coluna de cooperativa em arquivos multi-cooperativa.

## O que foi ajustado
1. **Largura da coluna/input Nome da Coluna Excel**
   - Ajustado o cabeçalho da tabela para dar mais espaço visual às colunas “Nome da Coluna Excel” e “Apelido”.
   - O input de “Nome da Coluna Excel” passou de largura fixa curta (`w-20`) para largura fluida (`w-full`) dentro da célula.

2. **Sugestão automática de Apelido**
   - Implementada função de formatação amigável (`toFriendlyAlias`) para sugerir apelido no padrão:
     - minúsculas
     - primeira letra maiúscula
     - texto limpo e legível
   - Regras aplicadas:
     - preenche automaticamente quando o apelido está vazio;
     - atualiza junto enquanto o apelido ainda corresponde ao último valor auto-gerado;
     - ao detectar edição manual do apelido, passa a respeitar o valor do usuário sem sobrescrever.

3. **Novo tipo “Nome cooperativa”**
   - Adicionada a opção **Nome cooperativa** no seletor de tipos.
   - Classificada na semântica de **Detalhe / exibição**.
   - Inclusão feita apenas para mapeamento visual/informativo na interface.

## O que propositalmente não foi alterado
- Nenhuma regra de chave.
- Nenhuma regra de matching.
- Nenhuma validação estrutural crítica do layout base.
- Nenhuma lógica de importação/processamento/conferência.
- Nenhuma alteração de arquitetura da tela ou criação de novos componentes.

## Validação final sobre o tipo “Nome cooperativa”
- O tipo foi adicionado com finalidade **apenas informativa/de exibição** na UI de mapeamento.
- Não foi conectado a regras estruturais (chave, matching, diagnóstico ou bloqueios críticos).
- Com isso, a regra central do sistema permanece inalterada e alinhada aos PRDs.
