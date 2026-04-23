/**
 * layoutBaseService.ts
 * 
 * Serviço de persistência real do Layout Base (GRL053).
 * Substitui completamente a dependência de mocks para a tela de Configurações.
 * 
 * Responsabilidades:
 * - Buscar layout ativo + colunas do banco
 * - Salvar (upsert) layout e sincronizar colunas (insert/update/delete)
 * - Não aplica normalização nem regras de negócio — apenas CRUD de configuração.
 */

import { supabase } from "@/integrations/supabase/client";

// Tipo local para coluna do layout base (alinhado com a tabela layouts_base_colunas)
export interface LayoutBaseColuna {
  id: string;
  nome_coluna_excel: string;
  apelido: string;
  tipo_coluna: string;
  analise: boolean;
  ordem: number;
  /** Flag local: true se a coluna ainda não foi persistida no banco */
  _isNew?: boolean;
}

// Tipo local para o layout base (alinhado com a tabela layouts_base)
export interface LayoutBase {
  id: string;
  nome: string;
  ativo: boolean;
  linha_cabecalho: number;
  linha_dados: number;
}

export interface LayoutBaseCompleto {
  layout: LayoutBase;
  colunas: LayoutBaseColuna[];
}

/**
 * Busca o layout base ativo e suas colunas.
 * Se não existir nenhum layout, retorna null.
 */
export async function fetchLayoutBase(): Promise<LayoutBaseCompleto | null> {
  // Busca o layout ativo (deve existir no máximo 1)
  const { data: layouts, error: layoutError } = await supabase
    .from("layouts_base")
    .select("*")
    .eq("ativo", true)
    .limit(1);

  if (layoutError) {
    throw new Error(`Erro ao buscar layout base: ${layoutError.message}`);
  }

  if (!layouts || layouts.length === 0) {
    return null;
  }

  const layout = layouts[0];

  // Busca colunas vinculadas ao layout, ordenadas pela posição
  const { data: colunas, error: colunasError } = await supabase
    .from("layouts_base_colunas")
    .select("*")
    .eq("layout_base_id", layout.id)
    .order("ordem", { ascending: true });

  if (colunasError) {
    throw new Error(`Erro ao buscar colunas do layout: ${colunasError.message}`);
  }

  return {
    layout: {
      id: layout.id,
      nome: layout.nome,
      ativo: layout.ativo,
      linha_cabecalho: layout.linha_cabecalho,
      linha_dados: layout.linha_dados,
    },
    colunas: (colunas || []).map((c) => ({
      id: c.id,
      nome_coluna_excel: c.nome_coluna_excel,
      apelido: c.apelido,
      tipo_coluna: c.tipo_coluna,
      analise: c.analise,
      ordem: c.ordem,
    })),
  };
}

/**
 * Salva o layout base e sincroniza suas colunas.
 * - Se o layout não existe, cria um novo.
 * - Se já existe, atualiza os campos do layout.
 * - Sincroniza colunas: remove as que foram deletadas, atualiza existentes, insere novas.
 * 
 * Retorna o layout completo atualizado após a persistência.
 */
export async function saveLayoutBase(
  layout: Partial<LayoutBase> & { linha_cabecalho: number; linha_dados: number },
  colunas: LayoutBaseColuna[]
): Promise<LayoutBaseCompleto> {
  let layoutId = layout.id;

  // Hardening: mantém somente 1 layout base ativo para evitar ambiguidade operacional na conferência.
  const desativarOutrosLayouts = async (idAtivo?: string) => {
    let query = supabase
      .from("layouts_base")
      .update({ ativo: false });

    if (idAtivo) query = query.neq("id", idAtivo);

    const { error } = await query.eq("ativo", true);
    if (error) throw new Error(`Erro ao normalizar layout ativo: ${error.message}`);
  };

  if (layoutId) {
    await desativarOutrosLayouts(layoutId);

    // Atualiza layout existente
    const { error } = await supabase
      .from("layouts_base")
      .update({
        ativo: true,
        linha_cabecalho: layout.linha_cabecalho,
        linha_dados: layout.linha_dados,
      })
      .eq("id", layoutId);

    if (error) {
      throw new Error(`Erro ao atualizar layout base: ${error.message}`);
    }
  } else {
    await desativarOutrosLayouts();

    // Cria novo layout base
    const { data, error } = await supabase
      .from("layouts_base")
      .insert({
        nome: "GRL053",
        ativo: true,
        linha_cabecalho: layout.linha_cabecalho,
        linha_dados: layout.linha_dados,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Erro ao criar layout base: ${error?.message}`);
    }

    layoutId = data.id;
  }

  // --- Sincronização de colunas ---

  // 1. Buscar IDs atuais no banco para detectar remoções
  const { data: colunasAtuais, error: fetchErr } = await supabase
    .from("layouts_base_colunas")
    .select("id")
    .eq("layout_base_id", layoutId);

  if (fetchErr) {
    throw new Error(`Erro ao buscar colunas atuais: ${fetchErr.message}`);
  }

  const idsAtuais = new Set((colunasAtuais || []).map((c) => c.id));
  const idsEnviados = new Set(colunas.filter((c) => !c._isNew).map((c) => c.id));

  // 2. Deletar colunas removidas pelo usuário
  const idsParaDeletar = [...idsAtuais].filter((id) => !idsEnviados.has(id));
  if (idsParaDeletar.length > 0) {
    const { error: delErr } = await supabase
      .from("layouts_base_colunas")
      .delete()
      .in("id", idsParaDeletar);

    if (delErr) {
      throw new Error(`Erro ao remover colunas: ${delErr.message}`);
    }
  }

  // 3. Upsert colunas (novas e existentes)
  for (let i = 0; i < colunas.length; i++) {
    const col = colunas[i];
    const payload = {
      layout_base_id: layoutId,
      nome_coluna_excel: col.nome_coluna_excel,
      apelido: col.apelido,
      tipo_coluna: col.tipo_coluna,
      analise: col.analise,
      ordem: i,
    };

    if (col._isNew) {
      // Nova coluna — inserir
      const { error } = await supabase
        .from("layouts_base_colunas")
        .insert(payload);

      if (error) {
        throw new Error(`Erro ao inserir coluna "${col.nome_coluna_excel}": ${error.message}`);
      }
    } else {
      // Coluna existente — atualizar
      const { error } = await supabase
        .from("layouts_base_colunas")
        .update(payload)
        .eq("id", col.id);

      if (error) {
        throw new Error(`Erro ao atualizar coluna "${col.nome_coluna_excel}": ${error.message}`);
      }
    }
  }

  // 4. Recarregar do banco para garantir consistência
  const result = await fetchLayoutBase();
  if (!result) {
    throw new Error("Layout não encontrado após salvamento.");
  }

  return result;
}
