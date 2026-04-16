
-- layouts_base: configuração do layout base GRL053
CREATE TABLE public.layouts_base (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT 'GRL053',
  ativo boolean NOT NULL DEFAULT true,
  linha_cabecalho integer NOT NULL DEFAULT 2,
  linha_dados integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.layouts_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on layouts_base"
  ON public.layouts_base FOR ALL
  USING (true) WITH CHECK (true);

-- layouts_base_colunas: colunas do layout base
CREATE TABLE public.layouts_base_colunas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_base_id uuid NOT NULL REFERENCES public.layouts_base(id) ON DELETE CASCADE,
  nome_coluna_excel text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  tipo_coluna text NOT NULL,
  analise boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0
);

ALTER TABLE public.layouts_base_colunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on layouts_base_colunas"
  ON public.layouts_base_colunas FOR ALL
  USING (true) WITH CHECK (true);

-- layouts_complementares: layouts de relatórios externos
CREATE TABLE public.layouts_complementares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  linha_cabecalho integer NOT NULL DEFAULT 2,
  linha_dados integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.layouts_complementares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on layouts_complementares"
  ON public.layouts_complementares FOR ALL
  USING (true) WITH CHECK (true);

-- layouts_complementares_colunas: colunas dos layouts complementares
CREATE TABLE public.layouts_complementares_colunas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_complementar_id uuid NOT NULL REFERENCES public.layouts_complementares(id) ON DELETE CASCADE,
  nome_coluna_excel text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  tipo_coluna text NOT NULL,
  analise boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0
);

ALTER TABLE public.layouts_complementares_colunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on layouts_complementares_colunas"
  ON public.layouts_complementares_colunas FOR ALL
  USING (true) WITH CHECK (true);
