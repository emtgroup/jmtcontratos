import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinhaParseada {
  contrato_vinculado: string;
  nota_fiscal: string;
  placa?: string;
  data?: string;
  dados_originais: Record<string, unknown>;
}

interface RequestBody {
  layout_complementar_id: string;
  nome_arquivo: string;
  linhas: LinhaParseada[];
}

// === Normalização (mesmas regras do PRD aplicadas no fluxo base) ===
function normalizarContrato(raw: string): string {
  const cleaned = raw.replace(/[^\d\-]/g, "");
  const beforeHyphen = cleaned.split("-")[0];
  return beforeHyphen.replace(/\D/g, "");
}
function normalizarNota(raw: string): string {
  return raw.replace(/\D/g, "");
}
function normalizarPlaca(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  return raw.toUpperCase().replace(/[\s\-]/g, "");
}
function gerarChave(contrato: string, nota: string): string {
  return `${contrato}::${nota}`;
}

function placaElegivel(placa: string | null): boolean {
  return !!placa && placa.trim().length > 0;
}

async function recalcularConferenciaPorChaves(
  supabase: ReturnType<typeof createClient>,
  chavesAfetadas: string[],
) {
  if (chavesAfetadas.length === 0) return;

  type BaseRow = {
    chave_normalizada: string;
    contrato_vinculado: string;
    nota_fiscal: string;
    placa_normalizada: string | null;
  };
  type CompRow = {
    chave_normalizada: string;
    contrato_vinculado: string;
    nota_fiscal: string;
    placa_normalizada: string | null;
    layout_complementar_id: string;
  };

  const baseRows: BaseRow[] = [];
  for (const lote of chunk(chavesAfetadas, 200)) {
    const { data, error } = await supabase
      .from("registros_base")
      .select("chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada")
      .in("chave_normalizada", lote);
    if (error) throw new Error(`Erro ao carregar base para conferência: ${error.message}`);
    baseRows.push(...(data || []));
  }

  const compsPorChave = new Map<string, CompRow[]>();
  const idsLayouts = new Set<string>();
  for (const lote of chunk(chavesAfetadas, 200)) {
    const { data, error } = await supabase
      .from("registros_complementares")
      .select("chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada, layout_complementar_id")
      .in("chave_normalizada", lote);
    if (error) throw new Error(`Erro ao carregar complementares por chave: ${error.message}`);
    for (const row of (data || []) as CompRow[]) {
      const arr = compsPorChave.get(row.chave_normalizada) || [];
      arr.push(row);
      compsPorChave.set(row.chave_normalizada, arr);
      idsLayouts.add(row.layout_complementar_id);
    }
  }

  const paresElegiveis = baseRows
    .filter((b) => b.nota_fiscal && placaElegivel(b.placa_normalizada))
    .map((b) => ({ nota: b.nota_fiscal, placa: b.placa_normalizada as string }));

  const candidatosPorPar = new Map<string, CompRow[]>();
  if (paresElegiveis.length > 0) {
    const notas = [...new Set(paresElegiveis.map((p) => p.nota))];
    const placas = [...new Set(paresElegiveis.map((p) => p.placa))];
    const { data, error } = await supabase
      .from("registros_complementares")
      .select("chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada, layout_complementar_id")
      .in("nota_fiscal", notas)
      .in("placa_normalizada", placas);
    if (error) throw new Error(`Erro ao carregar candidatos de diagnóstico: ${error.message}`);
    for (const row of (data || []) as CompRow[]) {
      const chavePar = `${row.nota_fiscal}::${row.placa_normalizada || ""}`;
      const arr = candidatosPorPar.get(chavePar) || [];
      arr.push(row);
      candidatosPorPar.set(chavePar, arr);
      idsLayouts.add(row.layout_complementar_id);
    }
  }

  const nomePorLayout = new Map<string, string>();
  if (idsLayouts.size > 0) {
    const { data, error } = await supabase
      .from("layouts_complementares")
      .select("id, nome")
      .in("id", [...idsLayouts]);
    if (error) throw new Error(`Erro ao carregar nomes de layouts: ${error.message}`);
    for (const row of data || []) nomePorLayout.set(row.id, row.nome);
  }

  const upserts: Array<{
    chave_normalizada: string;
    status: "vinculado" | "aguardando" | "divergente" | "ambiguo";
    origem: string | null;
    motivo_status: "vinculo_confirmado" | "sem_complementar" | "sem_diagnostico_elegivel" | "contrato_diferente" | "multiplas_correspondencias";
  }> = [];

  for (const base of baseRows) {
    const porChave = compsPorChave.get(base.chave_normalizada) || [];
    const layoutsDistintos = [...new Set(porChave.map((c) => c.layout_complementar_id))];

    if (layoutsDistintos.length === 1) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "vinculado",
        origem: nomePorLayout.get(layoutsDistintos[0]) || null,
        motivo_status: "vinculo_confirmado",
      });
      continue;
    }
    if (layoutsDistintos.length > 1) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "ambiguo",
        origem: null,
        motivo_status: "multiplas_correspondencias",
      });
      continue;
    }

    if (!base.nota_fiscal || !placaElegivel(base.placa_normalizada)) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "aguardando",
        origem: null,
        motivo_status: "sem_diagnostico_elegivel",
      });
      continue;
    }

    const chavePar = `${base.nota_fiscal}::${base.placa_normalizada || ""}`;
    const candidatos = candidatosPorPar.get(chavePar) || [];
    const candidatosUnicos = [...new Map(candidatos.map((c) => [c.chave_normalizada, c])).values()];

    if (candidatosUnicos.length === 0) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "aguardando",
        origem: null,
        motivo_status: "sem_complementar",
      });
      continue;
    }
    if (candidatosUnicos.length > 1) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "ambiguo",
        origem: null,
        motivo_status: "multiplas_correspondencias",
      });
      continue;
    }

    const candidato = candidatosUnicos[0];
    if (candidato.chave_normalizada !== base.chave_normalizada && candidato.contrato_vinculado !== base.contrato_vinculado) {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "divergente",
        origem: null,
        motivo_status: "contrato_diferente",
      });
    } else {
      upserts.push({
        chave_normalizada: base.chave_normalizada,
        status: "aguardando",
        origem: null,
        motivo_status: "sem_complementar",
      });
    }
  }

  for (const lote of chunk(upserts, 500)) {
    const { error } = await supabase
      .from("conferencia")
      .upsert(lote, { onConflict: "chave_normalizada" });
    if (error) throw new Error(`Erro ao atualizar conferência: ${error.message}`);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const LOCK_TIMEOUT_MIN = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let importacaoId: string | null = null;
  let lockAdquirido = false;

  try {
    const body: RequestBody = await req.json();

    if (!body.layout_complementar_id || !body.nome_arquivo || !Array.isArray(body.linhas) || body.linhas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requisição inválida: layout_complementar_id, nome_arquivo e linhas são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Carrega layout (precisamos do nome para usar como `origem` na conferência)
    const { data: layoutAtual, error: layoutErr } = await supabase
      .from("layouts_complementares")
      .select("id, nome, ativo")
      .eq("id", body.layout_complementar_id)
      .maybeSingle();

    if (layoutErr) throw new Error(`Erro ao carregar layout complementar: ${layoutErr.message}`);
    if (!layoutAtual) throw new Error("Layout complementar não encontrado.");
    if (!layoutAtual.ativo) throw new Error(`Layout complementar "${layoutAtual.nome}" está inativo.`);

    // === LOCK global (compartilhado com importação base) ===
    const { data: lockData, error: lockError } = await supabase
      .from("import_lock").select("*").eq("id", 1).single();
    if (lockError) throw new Error(`Erro ao verificar lock: ${lockError.message}`);

    if (lockData.locked) {
      const lockedAt = lockData.locked_at ? new Date(lockData.locked_at).getTime() : 0;
      const idadeMin = (Date.now() - lockedAt) / 60000;
      if (idadeMin < LOCK_TIMEOUT_MIN) {
        return new Response(
          JSON.stringify({ error: `Já existe uma importação em andamento (iniciada há ${idadeMin.toFixed(1)} min). Aguarde a conclusão.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (lockData.importacao_id) {
        await supabase.from("importacoes")
          .update({ status: "falhou" })
          .eq("id", lockData.importacao_id)
          .eq("status", "em_andamento");
      }
    }

    // Cria registro de importação (tipo: complementar)
    const { data: importacao, error: impError } = await supabase
      .from("importacoes")
      .insert({
        tipo: "complementar",
        layout_id: body.layout_complementar_id,
        nome_arquivo: body.nome_arquivo,
        total_linhas: body.linhas.length,
        status: "em_andamento",
        status_processamento: "processando",
        etapa_atual: "iniciando",
      })
      .select("id").single();
    if (impError) throw new Error(`Erro ao criar importação: ${impError.message}`);
    importacaoId = importacao.id;

    const { error: lockAcquireError } = await supabase
      .from("import_lock")
      .update({ locked: true, locked_at: new Date().toISOString(), importacao_id: importacaoId })
      .eq("id", 1);
    if (lockAcquireError) throw new Error(`Erro ao adquirir lock: ${lockAcquireError.message}`);
    lockAdquirido = true;

    // === Normalização em memória ===
    type LinhaProcessada = {
      chave: string;
      contrato: string;
      nota: string;
      placa: string | null;
      dados: Record<string, unknown>;
    };
    const processadas: LinhaProcessada[] = [];
    const chavesVistas = new Set<string>();
    let erros = 0;
    let primeiroErro: string | null = null;

    for (let i = 0; i < body.linhas.length; i++) {
      const linha = body.linhas[i];
      const contratoNorm = normalizarContrato(linha.contrato_vinculado || "");
      const notaNorm = normalizarNota(linha.nota_fiscal || "");
      if (!contratoNorm || !notaNorm) {
        erros++;
        if (!primeiroErro) primeiroErro = `Linha ${i + 1}: contrato ou nota inválidos (contrato="${linha.contrato_vinculado}", nota="${linha.nota_fiscal}")`;
        continue;
      }
      const chave = gerarChave(contratoNorm, notaNorm);
      if (chavesVistas.has(chave)) continue;
      chavesVistas.add(chave);
      processadas.push({
        chave,
        contrato: contratoNorm,
        nota: notaNorm,
        placa: normalizarPlaca(linha.placa),
        dados: linha.dados_originais || {},
      });
    }

    // === FILTRO BASE OBRIGATÓRIO: chave precisa existir em registros_base ===
    const todasChaves = processadas.map((p) => p.chave);
    const chavesNaBase = new Set<string>();
    for (const chunkChaves of chunk(todasChaves, 150)) {
      const { data: baseRows, error: baseErr } = await supabase
        .from("registros_base")
        .select("chave_normalizada")
        .in("chave_normalizada", chunkChaves);
      if (baseErr) throw new Error(`Erro ao verificar registros_base: ${baseErr.message}`);
      for (const r of baseRows || []) chavesNaBase.add(r.chave_normalizada);
    }

    // PRD: chave sem base → ignorar (não cria nada na base, não cria complementar).
    const validas = processadas.filter((p) => chavesNaBase.has(p.chave));
    const ignoradosSemBase = processadas.length - validas.length;

    // === Classifica contra registros_complementares (apenas deste layout) ===
    const chavesValidas = validas.map((p) => p.chave);
    const existentesMap = new Map<string, { id: string; contrato_vinculado: string; nota_fiscal: string; placa_normalizada: string | null }>();
    for (const chunkChaves of chunk(chavesValidas, 150)) {
      const { data: existentes, error: selErr } = await supabase
        .from("registros_complementares")
        .select("id, chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada")
        .eq("layout_complementar_id", body.layout_complementar_id)
        .in("chave_normalizada", chunkChaves);
      if (selErr) throw new Error(`Erro ao buscar registros complementares existentes: ${selErr.message}`);
      for (const r of existentes || []) existentesMap.set(r.chave_normalizada, r);
    }

    const paraInserir: Array<Record<string, unknown>> = [];
    const paraAtualizar: Array<{ id: string; chave: string; payload: Record<string, unknown> }> = [];
    let ignoradosSemMudanca = 0;

    for (const p of validas) {
      const existente = existentesMap.get(p.chave);
      if (!existente) {
        paraInserir.push({
          layout_complementar_id: body.layout_complementar_id,
          chave_normalizada: p.chave,
          contrato_vinculado: p.contrato,
          nota_fiscal: p.nota,
          placa_normalizada: p.placa,
          dados_originais: p.dados,
          ultima_importacao_id: importacaoId,
        });
      } else {
        const mudou =
          existente.contrato_vinculado !== p.contrato ||
          existente.nota_fiscal !== p.nota ||
          (existente.placa_normalizada || null) !== (p.placa || null);
        if (mudou) {
          paraAtualizar.push({
            id: existente.id,
            chave: p.chave,
            payload: {
              contrato_vinculado: p.contrato,
              nota_fiscal: p.nota,
              placa_normalizada: p.placa,
              dados_originais: p.dados,
              ultima_importacao_id: importacaoId,
            },
          });
        } else {
          ignoradosSemMudanca++;
        }
      }
    }

    // === BATCH INSERT ===
    let inseridos = 0;
    for (const lote of chunk(paraInserir, 500)) {
      const { error: insErr } = await supabase.from("registros_complementares").insert(lote);
      if (insErr) throw new Error(`Erro no insert em lote (${lote.length} linhas): ${insErr.message}`);
      inseridos += lote.length;
    }

    // === UPDATEs em paralelo controlado ===
    let atualizados = 0;
    const UPDATE_CONCURRENCY = 20;
    for (const lote of chunk(paraAtualizar, UPDATE_CONCURRENCY)) {
      const results = await Promise.all(
        lote.map(({ id, payload }) =>
          supabase.from("registros_complementares").update(payload).eq("id", id),
        ),
      );
      for (const r of results) {
        if (r.error) {
          erros++;
          if (!primeiroErro) primeiroErro = `Erro ao atualizar registro complementar: ${r.error.message}`;
        } else {
          atualizados++;
        }
      }
    }

    // ============================================================
    // RECÁLCULO DA CONFERÊNCIA COM MATCH PRINCIPAL + DIAGNÓSTICO
    // O backend materializa status e motivo_status para leitura direta no frontend.
    // ============================================================
    const chavesAfetadas = chavesValidas; // só recalcula chaves do arquivo atual que existem na base
    await recalcularConferenciaPorChaves(supabase, chavesAfetadas);

    let vinculados = 0;
    let aguardando = 0;
    let divergentes = 0;
    let ambiguos = 0;
    for (const chunkChaves of chunk(chavesAfetadas, 500)) {
      const { data: confRows, error: confSelErr } = await supabase
        .from("conferencia")
        .select("status")
        .in("chave_normalizada", chunkChaves);
      if (confSelErr) throw new Error(`Erro ao ler status da conferencia: ${confSelErr.message}`);
      for (const row of confRows || []) {
        if (row.status === "vinculado") vinculados++;
        else if (row.status === "divergente") divergentes++;
        else if (row.status === "ambiguo") ambiguos++;
        else aguardando++;
      }
    }

    // Total de "ignorados" reportado ao usuário inclui ambos os motivos:
    //   - ignorados sem base na linha (chave órfã)
    //   - sem mudanças (já existia idêntico)
    const ignoradosTotal = ignoradosSemBase + ignoradosSemMudanca;

    // Finaliza importação
    await supabase
      .from("importacoes")
      .update({
        inseridos,
        atualizados,
        ignorados: ignoradosTotal,
        erros,
        linhas_processadas: body.linhas.length,
        etapa_atual: "finalizando_importacao",
        status_processamento: "finalizado",
        status: "concluida",
      })
      .eq("id", importacaoId);

    // Libera lock
    await supabase.from("import_lock")
      .update({ locked: false, locked_at: null, importacao_id: null })
      .eq("id", 1);

    return new Response(JSON.stringify({
      importacao_id: importacaoId,
      total_linhas: body.linhas.length,
      inseridos,
      atualizados,
      ignorados: ignoradosTotal,
      ignorados_sem_base: ignoradosSemBase,
      vinculados,
      aguardando,
      divergentes,
      ambiguos,
      erros,
      primeiro_erro: primeiroErro,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno desconhecido";

    if (importacaoId) {
      await supabase.from("importacoes")
        .update({ status: "falhou", status_processamento: "erro", etapa_atual: "erro" })
        .eq("id", importacaoId)
        .then(() => {}, () => {});
    }
    if (lockAdquirido) {
      await supabase.from("import_lock")
        .update({ locked: false, locked_at: null, importacao_id: null })
        .eq("id", 1)
        .then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
