# Análise 1 — Versionamento do rodapé da sidebar

## Diagnóstico do problema encontrado
- O rodapé da sidebar estava lendo metadados de `src/config/system-info.ts` com valores fixos (`version` e `lastUpdated`) sem ligação com build/commit real.
- A data exibida era estática e manual (`14/04/2026 18:30`), portanto incorreta para novas publicações.
- A origem atual não trazia `commit sha` nem `commit date` reais.

## Origem atual incorreta da versão/data
- `src/config/system-info.ts` usava strings hardcoded.
- `src/components/AppSidebar.tsx` apenas renderizava esses valores fixos no rodapé.

## Decisão tomada (correção mínima)
- Reaproveitar a estrutura já existente (`systemInfo` + `AppSidebar`) sem alterar layout/base arquitetural.
- Injetar metadados no build via `vite.config.ts`:
  - versão da aplicação a partir de `package.json`
  - `commit sha` curto via Git (`git rev-parse --short HEAD`)
  - `commit date` ISO via Git (`git show -s --format=%cI HEAD`)
- Formatar a data no frontend com `Intl.DateTimeFormat` em `pt-BR` e timezone fixa `America/Cuiaba`.

## Fallback adotado
- Se não houver metadado real de commit/date (ou se data inválida):
  - mantém exibição da versão
  - oculta a linha `Atualizado em`
- Não usa horário atual como fallback, evitando informação falsa.

## Arquivos alterados
- `vite.config.ts`
- `src/config/system-info.ts`
- `src/components/AppSidebar.tsx`

## Como validar manualmente
1. Executar build/dev com metadados de Git disponíveis.
2. Abrir a aplicação e verificar o rodapé da sidebar:
   - linha de versão deve mostrar `v<versão>` e, se disponível, `(<sha_curto>)`
   - linha `Atualizado em` deve exibir data/hora formatada como `dd/mm/aaaa hh:mm`
3. Confirmar que a data respeita `America/Cuiaba` (não timezone implícita do navegador).
4. Simular ausência de metadados de commit (ambiente sem Git) e confirmar:
   - versão continua visível
   - linha `Atualizado em` não aparece.
