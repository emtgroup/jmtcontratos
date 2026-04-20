-- Tabela operacional complementar (1 registro por chave + layout)
CREATE TABLE IF NOT EXISTS public.registros_complementares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_complementar_id UUID NOT NULL REFERENCES public.layouts_complementares(id) ON DELETE CASCADE,
  chave_normalizada TEXT NOT NULL,
  contrato_vinculado TEXT NOT NULL,
  nota_fiscal TEXT NOT NULL,
  placa_normalizada TEXT,
  dados_originais JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultima_importacao_id UUID REFERENCES public.importacoes(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT registros_complementares_layout_chave_key UNIQUE (layout_complementar_id, chave_normalizada)
);

CREATE INDEX IF NOT EXISTS idx_registros_complementares_chave
  ON public.registros_complementares(chave_normalizada);

ALTER TABLE public.registros_complementares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on registros_complementares"
  ON public.registros_complementares FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_registros_complementares_updated_at
  BEFORE UPDATE ON public.registros_complementares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
