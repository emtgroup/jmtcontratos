# JM — Sistema de Conferência de Contratos

## 📌 Visão Geral

Sistema interno para conferência de contratos com base no relatório GRL053 (Base) e relatórios complementares.

O objetivo é permitir:

* validação rápida de vínculos entre Base e Complementar
* identificação de divergências
* investigação operacional eficiente

---

## 🧠 Conceito Central

> A tela não decide.
> O backend decide.
> A interface apenas exibe e guia a investigação.

---

## 📂 Estrutura do Projeto

```bash
/docs
  /PRD         # Fonte de verdade do sistema (regras e comportamento)
  /Analises    # Análises técnicas geradas pelo Codex
```

### Regras obrigatórias:

* PRDs devem ser consultados antes de qualquer implementação
* Análises devem ser salvas exclusivamente em `/docs/Analises`
* Nunca salvar arquivos na raiz do projeto

---

## 📘 PRDs (Fonte de Verdade)

Todos os comportamentos do sistema estão definidos em:

```
/docs/PRD
```

Principais documentos:

* Sistema de Conferência
* Motor de Matching e Diagnóstico
* Tela de Conferência
* Layout Base (GRL053)
* Layouts Complementares

### Regra:

> O código deve seguir os PRDs.
> O PRD não segue o código.

---

## ⚙️ Arquitetura

* Frontend: React + TypeScript
* Backend: Lovable Cloud (gerenciado)
* Banco: estruturado via modelos internos do Lovable

### Princípios:

* frontend não executa regra de negócio
* matching é feito no backend
* dados da conferência são materializados
* interface é somente leitura operacional

---

## 🔑 Regras Críticas do Sistema

### 1. Chave da conferência

```
CONTR. CLIENTE + NOTA
```

### 2. Fonte de verdade

* tabela: `conferencia`
* view: `vw_conferencia_tela`

### 3. Frontend NÃO pode:

* recalcular matching
* inferir vínculo
* alterar status
* tomar decisão semântica

---

## 🧩 Layout Base (GRL053)

* define a estrutura dos dados
* define os tipos de coluna
* não define regra de negócio

### Apelidos:

* utilizados apenas para exibição na UI
* nunca afetam processamento

---

## 🔍 Tela de Conferência

Principais características:

* leitura de dados consolidada
* filtros por status
* KPIs operacionais
* drawer para investigação

### Importante:

* dados analíticos não alteram status
* UI não interfere no resultado

---

## 🧪 Fluxo do Sistema

1. Importação do relatório Base
2. Importação de relatórios complementares
3. Processamento no backend
4. Atualização da tabela `conferencia`
5. Visualização na tela `/conferencia`

---

## 🛑 Restrições

* Não criar lógica de negócio no frontend
* Não alterar arquitetura sem necessidade
* Não criar novos padrões sem validar PRDs
* Sempre reutilizar código existente

---

## 🤖 Diretrizes para IA (Codex / Lovable)

Antes de qualquer alteração:

1. Ler PRDs em `/docs/PRD`
2. Entender contexto da funcionalidade
3. Não assumir comportamento
4. Aplicar mudanças mínimas e seguras
5. Gerar análise em `/docs/Analises`

---

## 📄 Padrão de Análises

Nome obrigatório:

```
analise-{numero}-{descricao}.md
```

Exemplo:

```
analise-1-importacao-base.md
analise-2-validacao-matching.md
```

---

## 🎯 Objetivo do Projeto

Ser um sistema:

* simples
* determinístico
* auditável
* confiável para operação diária

---

## 📞 Observação Final

Este sistema NÃO é um SaaS.
É uma ferramenta interna com foco em precisão operacional.

---
