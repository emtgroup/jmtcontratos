## 1. Objetivo da análise

Documentar, com evidências verificáveis no código e no ambiente disponível, a causa provável da falha na importação do layout complementar **Inpasa**, sem aplicar correções nesta etapa.

---

## 2. Sintoma observado

Erro recorrente na importação complementar indicando coluna não encontrada para o tipo `contrato_vinculado`, exigindo `CONTR. CLIENTE`, mesmo com configuração visual informada como:

- linha de cabeçalho = 2
- linha de dados = 3

A mensagem de erro já referencia explicitamente layout complementar `"Inpasa"`.

---

## 3. Fluxo técnico investigado

Fluxo real mapeado no código:

1. Tela `/importacao` carrega layouts complementares ativos (`listarLayoutsComplementaresAtivos`) e mantém o `layoutComplementarId` selecionado no estado da tela.
2. Ao importar complementar, `handleImportComplementar` chama `importarComplementar(file, layoutComplementarId, ...)`.
3. `importarComplementar` chama `carregarLayoutComplementarAtivo(layoutId)`.
4. `carregarLayoutComplementarAtivo` busca **por ID** (`layouts_complementares`) e depois carrega colunas em `layouts_complementares_colunas`.
5. O parser (`parseExcelFile`) usa `linha_cabecalho` e `linha_dados` vindos do layout carregado.
6. Em `resolverIndices`, cada `nome_coluna_excel` configurado é procurado no cabeçalho da linha definida; se não achar, lança erro com contexto de linha e nome do layout.
7. Se parse passar, `importarComplementar` envia para edge function `importar-complementar` com `layout_complementar_id`, `nome_arquivo` e `linhas`.

Conclusão do fluxo: o erro de coluna não encontrada ocorre **antes** da edge function, na validação/parse client-side.

---

## 4. Evidências encontradas

### 4.1 Evidência de seleção por ID (não por nome)

- Em `/importacao`, o `<SelectItem value={l.id}>` usa o ID como valor efetivo; o nome é apenas rótulo visual.
- O estado `layoutComplementarId` é repassado diretamente para `importarComplementar`.

**Impacto:** se o usuário seleciona "Inpasa", quem decide o mapeamento é o ID associado àquela opção no momento do carregamento.

### 4.2 Evidência de deduplicação por nome na listagem da importação

- `listarLayoutsComplementaresAtivos` busca layouts ativos por `created_at desc` e mantém apenas o primeiro por nome ("mais recente por nome").
- Isso reduz ambiguidade visual na lista, mas também pode ocultar duplicidades históricas com mesmo nome.

**Impacto:** duplicidade pode existir no banco; UI de importação mostra somente um por nome (mais recente).

### 4.3 Evidência de carregamento do layout complementar por ID e colunas do banco

- `carregarLayoutComplementarAtivo(layoutId)` consulta `layouts_complementares` por `.eq("id", layoutId)`.
- Depois consulta `layouts_complementares_colunas` por `.eq("layout_complementar_id", layout.id)`.

**Impacto:** erro "cobrando `CONTR. CLIENTE`" indica que `nome_coluna_excel` do tipo `contrato_vinculado` retornado desse ID era `CONTR. CLIENTE` no momento da execução.

### 4.4 Evidência de uso real das linhas de cabeçalho/dados

- `parseExcelFile` usa `headerRow = rawData[layout.linhaCabecalho - 1]`.
- `parseExcelFile` usa `dataRows = rawData.slice(layout.linhaDados - 1)`.
- Portanto, para layout com 2/3, o parser lê cabeçalho na linha 2 e dados na linha 3.

**Impacto:** com o código atual, não há indício de offset incorreto fixo para complementar.

### 4.5 Evidência do texto de erro com contexto de layout

- `resolverIndices` lança erro no formato:
  - coluna esperada (`nome_coluna_excel`)
  - tipo (`tipoNormalizado`)
  - linha de cabeçalho usada (`layout.linhaCabecalho`)
  - origem (`layout.origemLayout`) e nome (`layout.nomeLayout`)
  - cabeçalhos disponíveis

**Impacto:** mensagem já observada pelo usuário (com layout "Inpasa") é compatível com esse ponto exato do código.

### 4.6 Evidência sobre persistência em `/configuracoes`

- Ao editar layout existente (`layout.id` presente), `saveLayoutComplementar` executa `update` no mesmo ID.
- Ao criar sem ID, existe tentativa explícita de reutilizar layout ativo de mesmo nome antes de inserir novo.
- Colunas são sincronizadas com estratégia: buscar atuais → deletar removidas → insert/update restantes.

**Impacto:** fluxo atual tenta evitar duplicação e colunas órfãs, mas não impede duplicidade por variação de nome (ex.: espaços/case), e não há constraint única no banco por `nome`.

### 4.7 Evidência de schema permitindo duplicidade de nome

- Migração de `layouts_complementares` não define `UNIQUE(nome)`.
- RLS/policy permissiva (`Allow all`) não bloqueia essa condição.

**Impacto:** duplicidade de layouts com nome equivalente semanticamente é estruturalmente possível.

### 4.8 Auditoria direta do banco (status)

Tentativa executada para auditar `layouts_complementares` em ambiente remoto via REST (com variáveis de `.env`):

- Comando executado:
  - `curl ... /rest/v1/layouts_complementares?...nome=eq.Inpasa...`
- Resultado:
  - `curl: (56) CONNECT tunnel failed, response 403`

**Impacto:** não foi possível comprovar dados reais do banco (IDs, duplicidade atual, colunas atuais de Inpasa) neste ambiente.

---

## 5. Hipóteses avaliadas

### Hipótese 1. layout complementar duplicado com mesmo nome
**Classificação:** parcialmente comprovada.

- Comprovado no código/schema que duplicidade é possível e já foi tratada em nível de serviço/UI por deduplicação lógica.
- **Não comprovado** no banco atual se há, de fato, múltiplos `Inpasa` ativos.

### Hipótese 2. layout complementar correto, mas colunas salvas incorretamente
**Classificação:** parcialmente comprovada.

- Erro observado (`CONTR. CLIENTE` ausente) é coerente com `nome_coluna_excel` persistido para tipo `contrato_vinculado` naquele layout carregado.
- **Não comprovado** no banco atual qual valor está salvo hoje para cada ID `Inpasa`.

### Hipótese 3. problema de persistência na tela /configuracoes
**Classificação:** não comprovada.

- Fluxo de salvar/editar no código está consistente (update por ID, sincronização de colunas).
- Sem logs/telemetria de execução real, não há prova de falha funcional de persistência no ambiente.

### Hipótese 4. problema de parse do cabeçalho/linha
**Classificação:** descartada (para o cenário 2/3 informado).

- Código usa explicitamente `linha_cabecalho` e `linha_dados` do layout carregado.
- Não há hardcode conflitante detectado.

### Hipótese 5. problema de seleção do ID do layout na importação
**Classificação:** parcialmente comprovada (como risco).

- Seleção técnica é por ID correto da opção.
- Existe risco de discrepância entre expectativa do usuário e ID efetivo quando há layouts semanticamente duplicados/nomes parecidos ou lista não recarregada após alterações.
- **Não comprovado** que isso ocorreu no caso reportado.

### Hipótese 6. combinação de mais de uma causa
**Classificação:** provável (parcialmente comprovada).

Combinação mais consistente com evidências:
- configuração persistida de coluna diferente do arquivo real (`CONTR. CLIENTE`),
- com possível histórico de duplicidade/ambiguidade de layout por nome.

---

## 6. Causa raiz provável

**Causa raiz provável:** o parser está carregando, para o `layout_complementar_id` selecionado, uma configuração em que `contrato_vinculado` está mapeado para `nome_coluna_excel = "CONTR. CLIENTE"`, e esse cabeçalho não está presente na linha 2 da planilha importada.

- O mecanismo de linha (2/3) está tecnicamente aderente ao código.
- O ponto de falha é de mapeamento de coluna esperado vs cabeçalho encontrado.
- A confirmação final dos registros reais do banco ficou **não comprovada** por bloqueio de conexão (403).

---

## 7. Pontos ainda não comprovados

1. Lista real de todos os `layouts_complementares` com `nome = 'Inpasa'` (id, ativo, created_at, linha_cabecalho, linha_dados).
2. Colunas reais em `layouts_complementares_colunas` para cada ID `Inpasa`, especialmente tipos:
   - `contrato_vinculado`
   - `nota_fiscal`
   - `placa`
3. Existência de algum `Inpasa` com `nome_coluna_excel = 'CONTR. CLIENTE'` no banco atual.
4. Se o layout mais recente de fato está correto e sendo o mesmo escolhido no fluxo real do usuário.

---

## 8. Recomendação de correção mínima

Sem aplicar código agora, a validação mínima recomendada antes de qualquer ajuste é executar auditoria SQL no banco de produção/homologação (com acesso permitido) para fechar os pontos não comprovados.

Consultas mínimas necessárias:

```sql
-- 1) Layouts Inpasa
select id, nome, ativo, created_at, linha_cabecalho, linha_dados
from layouts_complementares
where nome ilike 'Inpasa'
order by created_at desc;

-- 2) Colunas dos layouts Inpasa
select lc.layout_complementar_id, l.nome, l.created_at, lc.id, lc.tipo_coluna, lc.nome_coluna_excel, lc.apelido, lc.ordem
from layouts_complementares_colunas lc
join layouts_complementares l on l.id = lc.layout_complementar_id
where l.nome ilike 'Inpasa'
order by l.created_at desc, lc.ordem asc;

-- 3) Filtro dos tipos críticos
select lc.layout_complementar_id, l.nome, l.created_at, lc.tipo_coluna, lc.nome_coluna_excel
from layouts_complementares_colunas lc
join layouts_complementares l on l.id = lc.layout_complementar_id
where l.nome ilike 'Inpasa'
  and lower(replace(lc.tipo_coluna, ' ', '_')) in ('contrato_vinculado','nota_fiscal','placa')
order by l.created_at desc, lc.tipo_coluna;
```

---

## 9. Arquivos e tabelas envolvidos

### Front-end / serviços
- `src/pages/Importacao.tsx`
- `src/services/importacaoBaseService.ts`
- `src/pages/Configuracoes.tsx`
- `src/services/layoutComplementarService.ts`

### Edge function
- `supabase/functions/importar-complementar/index.ts`

### Schema / banco
- `supabase/migrations/20260416134210_c45e64cf-6d22-4c1f-bcdf-d6295cda9cef.sql`
- tabelas:
  - `layouts_complementares`
  - `layouts_complementares_colunas`
  - `registros_complementares`
  - `conferencia`

### PRDs validados
- `public/PRD/PRD — Sistema de Conferência de Contratos (V6).md`
- `public/PRD/Mini PRD — Tela de Importação de Relatórios.txt`
- `public/PRD/Mini PRD — Esquema de Dados do Sistema.txt`
- `public/PRD/Mini PRD — Tela de Layouts Complementares.txt`
- `public/PRD/Mini PRD — Tela de Conferência de Contratos.txt`

---

## 10. Conclusão final

Com base nas evidências de código, a falha atual **não aponta para erro de linha de cabeçalho/dados** (2/3), e sim para **mapeamento de coluna esperado no layout carregado por ID**.

A mensagem exigindo `CONTR. CLIENTE` é consistente com configuração persistida de `nome_coluna_excel` para `contrato_vinculado` no layout utilizado no momento da importação.

A confirmação definitiva da causa (incluindo duplicidade real de `Inpasa` e valores exatos salvos) permanece **não comprovada** neste ambiente por impedimento de acesso remoto ao banco (`CONNECT tunnel failed, 403`).
