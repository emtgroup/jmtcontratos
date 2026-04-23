# Validação final — feature `exibir_no_drawer` (layout base + conferência)

## 1) Banco
- Migration existente e válida para `layouts_base_colunas.exibir_no_drawer`:
  - `supabase/migrations/20260423143000_add_exibir_no_drawer_layout_base_colunas.sql`
- Definição confirmada:
  - `BOOLEAN NOT NULL DEFAULT false`

## 2) Tipagem e service
- Supabase types atualizados (`Row/Insert/Update`) com `exibir_no_drawer`.
- `LayoutBaseColuna` atualizado no service.
- Persistência com fallback booleano no `saveLayoutBase`.
- Leitura com fallback booleano no `fetchLayoutBase`.

## 3) Frontend
- `normalizaTipoColuna` existe em `src/pages/Conferencia.tsx` e é usada na montagem dos campos extras.
- Sem erro de build após validação.
- Tela de configurações com tooltip e checkbox de `Exibir no drawer`.

## 4) Drawer — cenários validados
1. Campo marcado com valor: aparece no bloco adicional.
2. Campo marcado sem valor/ausente: aparece com `—`.
3. Campo não marcado: não aparece no bloco adicional.
4. Sem campos marcados: bloco adicional não é renderizado.

## 5) Performance
- Busca pontual de 1 registro por chave no drawer:
  - `.eq("chave_normalizada", linha.chave).limit(1).maybeSingle()`
- Sem join extra na grid e sem alteração de `vw_conferencia_tela`.
- Índice por chave confirmado no histórico de migrations:
  - `idx_registros_base_chave` (obrigatório por PRD).

## 6) PRDs
- PRD 05 atualizado com definição de `exibir_no_drawer` como metadado visual.
- PRD 03/09 atualizados com regra: bloco fixo + bloco adicional; vazio = `—`; sem impacto em grid/matching/status/chave/importação.

## 7) Conclusão
- Feature validada e blindada com escopo preservado.
- Grid principal, status, matching, chave e importação permanecem inalterados.
