-- Hardening: garante somente 1 layout base ativo para evitar ambiguidade de apelidos na conferência.

WITH ativos_ordenados AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn
  FROM public.layouts_base
  WHERE ativo = true
)
UPDATE public.layouts_base lb
SET ativo = false
FROM ativos_ordenados a
WHERE lb.id = a.id
  AND a.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_layouts_base_ativo_unico
  ON public.layouts_base (ativo)
  WHERE ativo = true;
