
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on importacoes" ON public.importacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on registros_base" ON public.registros_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on conferencia" ON public.conferencia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on import_lock" ON public.import_lock FOR ALL USING (true) WITH CHECK (true);
