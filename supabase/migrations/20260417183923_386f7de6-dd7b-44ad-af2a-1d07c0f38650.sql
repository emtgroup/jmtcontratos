ALTER TABLE public.importacoes DROP CONSTRAINT IF EXISTS importacoes_status_check;
ALTER TABLE public.importacoes ADD CONSTRAINT importacoes_status_check
  CHECK (status IN ('em_andamento','concluida','falhou'));

UPDATE public.import_lock SET locked=false, locked_at=null, importacao_id=null WHERE id=1;
UPDATE public.importacoes SET status='falhou' WHERE status='em_andamento';