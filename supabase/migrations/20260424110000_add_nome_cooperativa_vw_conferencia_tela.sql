-- Exposição de "Nome cooperativa" na view operacional da conferência.
-- Regra crítica: o valor é resolvido pelo tipo lógico no layout base ativo,
-- sem depender de nome físico fixo de coluna Excel.

DROP VIEW IF EXISTS public.vw_conferencia_tela;

CREATE VIEW public.vw_conferencia_tela
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.chave_normalizada,
  c.status,
  c.motivo_status,
  c.origem,
  rb.contrato_vinculado,
  NULLIF(TRIM(CASE
    WHEN cfg.coluna_contrato_interno IS NULL THEN NULL
    ELSE rb.dados_originais ->> cfg.coluna_contrato_interno
  END), '') AS contrato_interno,
  rb.nota_fiscal,
  NULLIF(TRIM(CASE
    WHEN cfg.coluna_clifor IS NULL THEN NULL
    ELSE rb.dados_originais ->> cfg.coluna_clifor
  END), '') AS clifor,
  NULLIF(TRIM(CASE
    WHEN cfg.coluna_nome_cooperativa IS NULL THEN NULL
    ELSE rb.dados_originais ->> cfg.coluna_nome_cooperativa
  END), '') AS nome_cooperativa,
  rb.placa_normalizada AS placa,
  rb.data_referencia,
  rb.updated_at
FROM public.conferencia c
JOIN public.registros_base rb
  ON rb.chave_normalizada = c.chave_normalizada
LEFT JOIN LATERAL (
  SELECT
    MAX(nome_coluna_excel) FILTER (WHERE lower(replace(trim(tipo_coluna), ' ', '_')) = 'contrato_interno') AS coluna_contrato_interno,
    MAX(nome_coluna_excel) FILTER (WHERE lower(replace(trim(tipo_coluna), ' ', '_')) = 'clifor') AS coluna_clifor,
    MAX(nome_coluna_excel) FILTER (WHERE lower(replace(trim(tipo_coluna), ' ', '_')) = 'nome_cooperativa') AS coluna_nome_cooperativa
  FROM public.layouts_base_colunas lbc
  JOIN public.layouts_base lb ON lb.id = lbc.layout_base_id
  WHERE lb.ativo = true
) cfg ON true;
