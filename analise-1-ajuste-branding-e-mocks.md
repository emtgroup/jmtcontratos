# Análise 1 — Ajuste de branding e mocks (JM Contabilidade)

## O que foi alterado
- Branding visual do sistema atualizado de **SICON** para **JM / JM Contabilidade** no header e sidebar, preservando o layout atual.
- Dados mockados da conferência revisados para contratos/notas/placas com aparência mais realista do contexto operacional.
- Exibição da chave determinística mockada ajustada para ficar coerente visualmente com contrato + nota sem lógica real.
- Labels de peso padronizados para o vocabulário do projeto: **Peso Fiscal** e **Peso Líquido**.
- Textos auxiliares em importação e configurações revisados para refletir o fluxo real esperado, mantendo comportamento mock.
- Mocks de configuração/layout atualizados com campos lógicos mais aderentes ao cenário real (Contrato Vinculado, Nota Fiscal, Placa, Peso Fiscal, Peso Líquido, Data, Clifor).

## Labels padronizados
- `Peso Base` → `Peso Fiscal`
- `Peso Compl.` / `Peso Complementar` → `Peso Líquido`
- Branding visível: `SICON` / `SICON | Contabilidade` → `JM Contabilidade`

## Exemplos de mocks revisados
- Contratos em formato mais realista:
  - `MTP 16876`
  - `AFX 33610-33316`
  - `33044`
  - `17290-1`
  - `BXA 55421`
- Notas fiscais sem prefixo `NF-`:
  - `25031`, `12345`, `000456`, `987654`, `451299`, `804512`
- Origens mockadas mais aderentes:
  - `GRL053`, `Inpasa`, `FS`, `Bunge`
- Layouts complementares mockados:
  - `Inpasa - Recebimento`
  - `FS - Controle de Carga`

## O que continuou propositalmente mockado
- Resumo de importação (totais, inseridos, atualizados, ignorados, etc.).
- Registros de conferência e status.
- Chave determinística apenas visual/mock.
- Configuração de layouts e criação de novo layout somente no front.

## O que não foi implementado de propósito nesta etapa
- Backend/API real.
- Persistência em banco.
- Normalização determinística real.
- Motor definitivo de matching/vinculação.
- Validações funcionais completas de importação/configuração.

## Observações
- Ajustes feitos de forma pontual e segura, sem refatoração de arquitetura, sem alteração da navegação principal e sem criação de novas páginas.
