# Análise 5 — Semântica visual dos tipos de coluna

## O que foi alterado

- A tela **Configurações de Layout** recebeu textos de orientação mais diretos nos contextos de **Layout Base (GRL053)** e **Layouts Complementares**, alinhando os tipos de coluna aos papéis descritos nos PRDs.
- O campo **Tipo da Coluna** passou a exibir, logo abaixo do seletor, uma indicação visual curta de categoria:
  - Base de identificação
  - Apoio para diagnóstico
  - Informativo/analítico
  - Coluna adicional
- O comportamento foi aplicado de forma consistente nos dois contextos de mapeamento (base e complementar).

## Como a interface passou a comunicar melhor o papel dos tipos

- Foi adicionada explicação semântica na área de ajuda da tela para orientar o usuário sobre como o sistema interpreta o mapeamento.
- Cada seleção de tipo agora mostra uma etiqueta discreta com a categoria funcional daquele tipo no processo de conferência.
- A leitura ficou mais didática sem introduzir regras automáticas, mantendo a experiência compacta.

## Tipos com destaque de identificação principal

Os tipos com destaque visual de identificação principal são:

- **Contrato vinculado**
- **Nota fiscal**

Ambos recebem indicação de “campo principal” e badge de maior destaque em relação aos demais tipos.

## O que continua mockado

- Não foi implementada validação funcional de obrigatoriedade, unicidade ou bloqueio de salvamento.
- Não foi criado backend.
- Não foi adicionado processamento real de importação, normalização ou conferência.
- A interação continua em modo front/mock com reforço apenas semântico e visual.

## O que ficará para fase de lógica/backend

- Validações obrigatórias de layout (presença e unicidade de Contrato vinculado e Nota fiscal).
- Regras funcionais de salvamento e impedimento de layout inválido.
- Uso real dos tipos no pipeline de importação, geração de chave e matching.
- Persistência em banco e integração com processamento de conferência.

## Dúvidas/ambiguidade documentadas

- Os Mini PRDs de Layout Base e Layouts Complementares descrevem validações obrigatórias para impedir salvamento em configurações inválidas. Nesta tarefa, por restrição explícita, essas validações **não foram ativadas** e permaneceram para a etapa funcional.
