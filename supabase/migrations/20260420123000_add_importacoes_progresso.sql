-- Telemetria mínima para progresso real da importação Base sem criar nova arquitetura.
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS status_processamento TEXT NOT NULL DEFAULT 'processando'
    CHECK (status_processamento IN ('processando', 'finalizado', 'erro')),
  ADD COLUMN IF NOT EXISTS etapa_atual TEXT NOT NULL DEFAULT 'iniciando',
  ADD COLUMN IF NOT EXISTS linhas_processadas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erros INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Mantém consistência histórica entre status antigo e novo status_processamento.
UPDATE public.importacoes
SET
  status_processamento = CASE
    WHEN status = 'concluida' THEN 'finalizado'
    WHEN status = 'falhou' THEN 'erro'
    ELSE 'processando'
  END,
  etapa_atual = CASE
    WHEN status = 'concluida' THEN 'finalizando_importacao'
    WHEN status = 'falhou' THEN 'erro'
    ELSE 'processando_importacao'
  END,
  linhas_processadas = COALESCE(total_linhas, 0),
  erros = COALESCE(erros, 0);

DROP TRIGGER IF EXISTS update_importacoes_updated_at ON public.importacoes;
CREATE TRIGGER update_importacoes_updated_at
  BEFORE UPDATE ON public.importacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
