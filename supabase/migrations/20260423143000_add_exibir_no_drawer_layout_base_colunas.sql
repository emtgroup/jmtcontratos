-- Flag visual para controlar apenas campos extras exibidos no drawer da conferência.
-- Não altera chave, matching, status ou lógica de processamento.

ALTER TABLE public.layouts_base_colunas
  ADD COLUMN IF NOT EXISTS exibir_no_drawer boolean NOT NULL DEFAULT false;
