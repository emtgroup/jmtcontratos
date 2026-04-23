-- Backfill auditável de data_referencia para registros legados da Base.
-- Regra determinística:
-- - usa apenas o layout base ativo
-- - aceita somente tipo lógico de data: data_da_nota ou data
-- - não sobrescreve valores já preenchidos
-- - não infere quando configuração estiver ambígua

DO $$
DECLARE
  v_qtd_layouts_ativos integer;
  v_qtd_colunas_data integer;
  v_coluna_data text;
  v_atualizados integer := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_qtd_layouts_ativos
  FROM public.layouts_base
  WHERE ativo = true;

  IF v_qtd_layouts_ativos <> 1 THEN
    RAISE NOTICE '[BACKFILL_DATA_REFERENCIA] Abortado: esperado 1 layout base ativo, encontrado %.', v_qtd_layouts_ativos;
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    MAX(lbc.nome_coluna_excel)
    INTO v_qtd_colunas_data, v_coluna_data
  FROM public.layouts_base_colunas lbc
  JOIN public.layouts_base lb
    ON lb.id = lbc.layout_base_id
  WHERE lb.ativo = true
    AND lower(replace(trim(lbc.tipo_coluna), ' ', '_')) IN ('data_da_nota', 'data');

  IF v_qtd_colunas_data <> 1 OR v_coluna_data IS NULL THEN
    RAISE NOTICE '[BACKFILL_DATA_REFERENCIA] Abortado: esperado 1 coluna de data mapeada no layout ativo, encontrado %.', v_qtd_colunas_data;
    RETURN;
  END IF;

  UPDATE public.registros_base rb
  SET data_referencia = NULLIF(TRIM(rb.dados_originais ->> v_coluna_data), '')
  WHERE rb.data_referencia IS NULL
    AND NULLIF(TRIM(rb.dados_originais ->> v_coluna_data), '') IS NOT NULL;

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  RAISE NOTICE '[BACKFILL_DATA_REFERENCIA] Coluna origem="%". Registros atualizados=%.', v_coluna_data, v_atualizados;
END $$;
