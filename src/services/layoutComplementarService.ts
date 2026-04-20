/**
 * layoutComplementarService.ts
 *
 * Serviço de persistência real dos Layouts Complementares.
 * Segue exatamente o mesmo padrão do layoutBaseService.ts.
 *
 * Responsabilidades:
 * - Buscar todos os layouts complementares + colunas do banco
 * - Salvar (upsert) layout e sincronizar colunas (insert/update/delete)
 * - Deletar layout (FK cascade remove colunas automaticamente)
 */

import { supabase } from "@/integrations/supabase/client";

// Reutiliza mesma shape de coluna do layout base (campos idênticos)
export interface LayoutComplementarColuna {
  id: string;
  nome_coluna_excel: string;
  apelido: string;
  tipo_coluna: string;
  analise: boolean;
  ordem: number;
  /** Flag local: true se a coluna ainda não foi persistida no banco */
  _isNew?: boolean;
}

export interface LayoutComplementar {
  id: string;
  nome: string;
  ativo: boolean;
  linha_cabecalho: number;
  linha_dados: number;
}

export interface LayoutComplementarCompleto {
  layout: LayoutComplementar;
  colunas: LayoutComplementarColuna[];
}

/**
 * Busca todos os layouts complementares ativos e suas colunas.
 */
export async function fetchLayoutsComplementares(): Promise<LayoutComplementarCompleto[]> {
  const { data: layouts, error: layoutError } = await supabase
    .from("layouts_complementares")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (layoutError) {
    throw new Error(`Erro ao buscar layouts complementares: ${layoutError.message}`);
  }

  if (!layouts || layouts.length === 0) return [];

  // Busca todas as colunas de todos os layouts de uma vez
  const layoutIds = layouts.map((l) => l.id);
  const { data: todasColunas, error: colunasError } = await supabase
    .from("layouts_complementares_colunas")
    .select("*")
    .in("layout_complementar_id", layoutIds)
    .order("ordem", { ascending: true });

  if (colunasError) {
    throw new Error(`Erro ao buscar colunas complementares: ${colunasError.message}`);
  }

  // Agrupa colunas por layout_complementar_id
  const colunasMap = new Map<string, LayoutComplementarColuna[]>();
  for (const c of todasColunas || []) {
    const arr = colunasMap.get(c.layout_complementar_id) || [];
    arr.push({
      id: c.id,
      nome_coluna_excel: c.nome_coluna_excel,
      apelido: c.apelido,
      tipo_coluna: c.tipo_coluna,
      analise: c.analise,
      ordem: c.ordem,
    });
    colunasMap.set(c.layout_complementar_id, arr);
  }

  return layouts.map((layout) => ({
    layout: {
      id: layout.id,
      nome: layout.nome,
      ativo: layout.ativo,
      linha_cabecalho: layout.linha_cabecalho,
      linha_dados: layout.linha_dados,
    },
    colunas: colunasMap.get(layout.id) || [],
  }));
}

/**
 * Salva (cria ou atualiza) um layout complementar e sincroniza suas colunas.
 * Mesmo fluxo do layoutBaseService: buscar IDs atuais → deletar removidos → upsert restantes → recarregar.
 */
export async function saveLayoutComplementar(
  layout: Partial<LayoutComplementar> & { nome: string; linha_cabecalho: number; linha_dados: number },
  colunas: LayoutComplementarColuna[]
): Promise<LayoutComplementarCompleto> {
  let layoutId = layout.id;
  const nomeNormalizado = layout.nome.trim();

  if (layoutId) {
    // Atualiza layout existente
    const { error } = await supabase
      .from("layouts_complementares")
      .update({
        nome: nomeNormalizado,
        linha_cabecalho: layout.linha_cabecalho,
        linha_dados: layout.linha_dados,
      })
      .eq("id", layoutId);

    if (error) {
      throw new Error(`Erro ao atualizar layout complementar: ${error.message}`);
    }
  } else {
    // Evita duplicar layouts com mesmo nome (ex.: "Inpasa"), o que gera seleção ambígua na importação.
    // Se já existir layout ativo com o mesmo nome, reutiliza o registro existente e atualiza os metadados.
    const { data: existenteMesmoNome, error: existenteErr } = await supabase
      .from("layouts_complementares")
      .select("id")
      .eq("nome", nomeNormalizado)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existenteErr) {
      throw new Error(`Erro ao verificar layout complementar existente: ${existenteErr.message}`);
    }

    if (existenteMesmoNome?.id) {
      layoutId = existenteMesmoNome.id;
      const { error: updateMesmoNomeErr } = await supabase
        .from("layouts_complementares")
        .update({
          nome: nomeNormalizado,
          linha_cabecalho: layout.linha_cabecalho,
          linha_dados: layout.linha_dados,
        })
        .eq("id", layoutId);

      if (updateMesmoNomeErr) {
        throw new Error(`Erro ao atualizar layout complementar existente: ${updateMesmoNomeErr.message}`);
      }
    } else {
      // Cria novo layout complementar somente quando não existe outro ativo com o mesmo nome.
      const { data, error } = await supabase
        .from("layouts_complementares")
        .insert({
          nome: nomeNormalizado,
          ativo: true,
          linha_cabecalho: layout.linha_cabecalho,
          linha_dados: layout.linha_dados,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Erro ao criar layout complementar: ${error?.message}`);
      }

      layoutId = data.id;
    }
  }

  // --- Sincronização de colunas (mesmo padrão do base) ---

  // 1. Buscar IDs atuais no banco
  const { data: colunasAtuais, error: fetchErr } = await supabase
    .from("layouts_complementares_colunas")
    .select("id")
    .eq("layout_complementar_id", layoutId);

  if (fetchErr) {
    throw new Error(`Erro ao buscar colunas atuais: ${fetchErr.message}`);
  }

  const idsAtuais = new Set((colunasAtuais || []).map((c) => c.id));
  const idsEnviados = new Set(colunas.filter((c) => !c._isNew).map((c) => c.id));

  // 2. Deletar colunas removidas pelo usuário
  const idsParaDeletar = [...idsAtuais].filter((id) => !idsEnviados.has(id));
  if (idsParaDeletar.length > 0) {
    const { error: delErr } = await supabase
      .from("layouts_complementares_colunas")
      .delete()
      .in("id", idsParaDeletar);

    if (delErr) {
      throw new Error(`Erro ao remover colunas: ${delErr.message}`);
    }
  }

  // 3. Insert/update colunas uma a uma
  for (let i = 0; i < colunas.length; i++) {
    const col = colunas[i];
    const payload = {
      layout_complementar_id: layoutId,
      nome_coluna_excel: col.nome_coluna_excel,
      apelido: col.apelido,
      tipo_coluna: col.tipo_coluna,
      analise: col.analise,
      ordem: i,
    };

    if (col._isNew) {
      const { error } = await supabase
        .from("layouts_complementares_colunas")
        .insert(payload);

      if (error) {
        throw new Error(`Erro ao inserir coluna "${col.nome_coluna_excel}": ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from("layouts_complementares_colunas")
        .update(payload)
        .eq("id", col.id);

      if (error) {
        throw new Error(`Erro ao atualizar coluna "${col.nome_coluna_excel}": ${error.message}`);
      }
    }
  }

  // 4. Recarregar do banco para garantir consistência
  const all = await fetchLayoutsComplementares();
  const saved = all.find((l) => l.layout.id === layoutId);
  if (!saved) {
    throw new Error("Layout complementar não encontrado após salvamento.");
  }

  return saved;
}

/**
 * Exclui um layout complementar.
 * A FK cascade na tabela layouts_complementares_colunas remove as colunas automaticamente.
 */
export async function deleteLayoutComplementar(id: string): Promise<void> {
  const { error } = await supabase
    .from("layouts_complementares")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir layout complementar: ${error.message}`);
  }
}
