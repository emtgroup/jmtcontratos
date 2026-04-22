# 1. Resumo executivo

A fonte da tela `/conferencia` foi enriquecida no backend para entregar contexto diagnóstico real, removendo dependência de placeholders no front para `motivo_status`, `placa` e `data`.

Foi aplicada correção mínima e localizada em três pontos:
- materialização do motivo no backend (`conferencia.motivo_status`);
- exposição dos campos operacionais na view (`vw_conferencia_tela`);
- ajuste do recálculo de conferência no pipeline para refletir status + motivo sem lógica no frontend.

Também foi auditada a aderência ao PRD de matching: antes havia desalinhamento prático para `divergente`; após ajuste, o backend passa a materializar `divergente` por diagnóstico secundário elegível (`nota + placa`) quando houver candidato único com contrato diferente.

---

# 2. Fonte atual da tela

## Antes da correção
A `vw_conferencia_tela` entregava apenas:
- `id`
- `chave_normalizada`
- `status`
- `origem`
- `contrato_vinculado`
- `nota_fiscal`
- `updated_at`

Isso era insuficiente para investigação operacional na UI (motivo, placa e data ausentes).

## Após a correção
A `vw_conferencia_tela` passou a entregar também:
- `motivo_status`
- `placa`
- `data_referencia`

Mantendo a premissa de dataset único para a tela.

---

# 3. Campos faltantes identificados

Campos que faltavam para atender o PRD da tela:
1. `motivo_status` materializado no backend;
2. `placa` operacional da base na view;
3. `data` operacional da base na view;
4. contexto mínimo para drawer sem inferência no frontend.

---

# 4. O que foi alterado no backend/view

## Migração
Foi criada migração para:
- adicionar `registros_base.data_referencia`;
- adicionar `conferencia.motivo_status` com check constraint de motivos permitidos;
- recriar `vw_conferencia_tela` com os novos campos (`motivo_status`, `placa`, `data_referencia`).

## Pipeline de materialização
Nos edge functions de importação (`importar-base` e `importar-complementar`):
- foi incorporado recálculo backend de conferência por chave afetada;
- o recálculo agora materializa **status + origem + motivo_status**;
- foi adicionado tratamento de diagnóstico secundário elegível por `nota_fiscal + placa_normalizada`.

## Parse da base
No parser da base:
- passou a capturar campo de data quando tipo configurado no layout for `data_da_nota` ou `data`;
- valor é persistido em `registros_base.data_referencia` como informativo.

---

# 5. Como `motivo_status` foi definido

O `motivo_status` foi definido por regra backend materializada, sem cálculo no frontend:

- `vinculo_confirmado`
  - quando há correspondência única por chave (match principal);
- `multiplas_correspondencias`
  - quando há ambiguidade por múltiplos layouts na chave
  - ou múltiplos candidatos no diagnóstico secundário;
- `sem_diagnostico_elegivel`
  - quando não há match por chave e a base não possui condição elegível de diagnóstico (`nota`/`placa` inválidas);
- `sem_complementar`
  - quando sem match por chave e sem candidatos no diagnóstico secundário elegível;
- `contrato_diferente`
  - quando sem match por chave e há candidato único no diagnóstico secundário com contrato diferente.

A UI apenas consome e exibe.

---

# 6. Aderência ao PRD do matching

## Conclusão objetiva
- **Antes**: havia desalinhamento prático para `divergente` (fluxo não materializava o status de forma efetiva na conferência).
- **Depois**: o backend passou a materializar `divergente` por diagnóstico secundário elegível, aproximando o comportamento do PRD.

## Status cobertos após ajuste
- `vinculado`: match principal por chave com correspondência única;
- `aguardando`: sem match e sem conclusão diagnóstica;
- `divergente`: diagnóstico secundário com candidato único e contrato diferente;
- `ambiguo`: múltiplas correspondências (por chave multi-layout ou diagnóstico com múltiplos candidatos).

Observação: o recálculo segue direcionado às chaves afetadas na importação, preservando abordagem incremental.

---

# 7. O que foi alterado no front (se houver)

Alteração pontual em `/conferencia` para consumir campos reais do backend:
- leitura de `motivo_status` real;
- leitura de `placa` real;
- leitura de `data_referencia` real;
- remoção de placeholder de motivo da tabela/drawer quando backend fornece valor.

Não houve redesenho de tela nem nova lógica de matching no frontend.

---

# 8. Riscos remanescentes

1. Campos de data dependem da configuração correta do layout base (`data_da_nota`/`data`).
2. Como o recálculo é por chaves afetadas, cenários cruzados raros de diagnóstico entre chaves não afetadas no lote podem demandar futura ampliação do escopo incremental.
3. O motivo `sem_complementar` e `sem_diagnostico_elegivel` dependem da qualidade dos campos normalizados na base/complementar.

---

# 9. Como validar manualmente

1. Importar base com placa e data mapeadas no layout.
2. Importar complementar com cenários de:
   - match por chave;
   - ausência de complementar;
   - candidato único por `nota+placa` com contrato diferente;
   - múltiplas correspondências.
3. Abrir `/conferencia` e validar:
   - `motivo_status` exibido sem placeholder;
   - `placa` e `data` exibidas quando disponíveis;
   - drawer com contexto real da linha;
   - KPIs/filtros e paginação continuam estáveis.
4. Confirmar que frontend não recalcula status (apenas consome dataset da view).
