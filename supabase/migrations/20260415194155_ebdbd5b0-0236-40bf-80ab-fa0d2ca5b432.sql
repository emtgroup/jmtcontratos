
-- Tabela de auditoria de importações
CREATE TABLE public.importacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('base', 'complementar')),
  layout_id UUID,
  nome_arquivo TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  inseridos INTEGER NOT NULL DEFAULT 0,
  atualizados INTEGER NOT NULL DEFAULT 0,
  ignorados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida', 'erro')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela operacional principal (Base GRL053)
CREATE TABLE public.registros_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave_normalizada TEXT NOT NULL UNIQUE,
  contrato_vinculado TEXT NOT NULL,
  nota_fiscal TEXT NOT NULL,
  placa_normalizada TEXT,
  dados_originais JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultima_importacao_id UUID REFERENCES public.importacoes(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para performance de busca por chave
CREATE INDEX idx_registros_base_chave ON public.registros_base(chave_normalizada);

-- Tabela de conferência (resultado materializado)
CREATE TABLE public.conferencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave_normalizada TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('vinculado', 'aguardando', 'divergente', 'ambiguo')),
  origem TEXT
);

-- Índice para performance
CREATE INDEX idx_conferencia_chave ON public.conferencia(chave_normalizada);
CREATE INDEX idx_conferencia_status ON public.conferencia(status);

-- Lock de concorrência (single row)
CREATE TABLE public.import_lock (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  importacao_id UUID
);

-- Inserir row fixa de lock
INSERT INTO public.import_lock (id, locked) VALUES (1, false);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para registros_base
CREATE TRIGGER update_registros_base_updated_at
  BEFORE UPDATE ON public.registros_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
