-- View de leitura para a tela de conferência.
-- Mantém a regra do PRD: frontend consome um único dataset consolidado, sem join semântico na UI.
CREATE OR REPLACE VIEW public.vw_conferencia_tela
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.chave_normalizada,
  c.status,
  c.origem,
  rb.contrato_vinculado,
  rb.nota_fiscal,
  rb.updated_at
FROM public.conferencia c
JOIN public.registros_base rb
  ON rb.chave_normalizada = c.chave_normalizada;
