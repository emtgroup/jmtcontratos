-- Enriquecimento mínimo da conferência para contexto real de diagnóstico na tela.
-- Mantém fonte única no backend sem mover decisão para o frontend.

ALTER TABLE public.registros_base
  ADD COLUMN IF NOT EXISTS data_referencia TEXT;

ALTER TABLE public.conferencia
  ADD COLUMN IF NOT EXISTS motivo_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conferencia_motivo_status_check'
  ) THEN
    ALTER TABLE public.conferencia
      ADD CONSTRAINT conferencia_motivo_status_check
      CHECK (
        motivo_status IS NULL OR motivo_status IN (
          'vinculo_confirmado',
          'sem_complementar',
          'sem_diagnostico_elegivel',
          'contrato_diferente',
          'multiplas_correspondencias'
        )
      );
  END IF;
END $$;

-- Evita erro 42P16 quando a definição antiga da view tem ordem/nomes incompatíveis.
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
  rb.nota_fiscal,
  rb.placa_normalizada AS placa,
  rb.data_referencia,
  rb.updated_at
FROM public.conferencia c
JOIN public.registros_base rb
  ON rb.chave_normalizada = c.chave_normalizada;
