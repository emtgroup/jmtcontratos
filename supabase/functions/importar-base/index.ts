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
  nome_arquivo: string;
  linhas: LinhaParseada[];
  layout_tem_data_mapeada?: boolean;
}

type EtapaImportacaoBackend =
  | "iniciando"
  | "validando_lock"
  | "normalizando_dados"
  | "classificando_registros"
  | "persistindo_registros"
  | "atualizando_conferencia"
  | "consolidando_resultado"
  | "finalizando_importacao"
  | "erro";

// === Normalização (regras oficiais do PRD) ===
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

function formatarDataIsoUtc(data: Date): string {
  const y = data.getUTCFullYear();
  const m = String(data.getUTCMonth() + 1).padStart(2, "0");
  const d = String(data.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Sanitização mínima e determinística para data_referencia:
// - remove espaços
// - evita string vazia
// - converte serial Excel simples (numérico inteiro) para YYYY-MM-DD quando seguro
function sanitizarDataReferencia(raw: string | undefined): string | null {
  if (!raw) return null;
  const valor = raw.trim();
  if (!valor) return null;

  // Excel serial date típico (dias desde 1899-12-30). Mantemos conversão conservadora.
  // Sem heurística avançada: se sair da faixa operacional, preserva string original.
  if (/^\d+$/.test(valor)) {
    const serial = Number(valor);
    if (Number.isInteger(serial) && serial >= 1 && serial <= 60000) {
      const baseUtc = Date.UTC(1899, 11, 30);
      const data = new Date(baseUtc + serial * 86400000);
      return formatarDataIsoUtc(data);
    }
  }

  return valor;
}

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableJsonStringify(v)}`);
  return `{${entries.join(",")}}`;
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

// Quebra array em chunks
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let importacaoId: string | null = null;
  let lockAdquirido = false;
  let ultimoUpdateProgresso = 0;

  // Persiste telemetria real no registro de importação em marcos de etapa/lote.
  // Não atualizamos por linha para evitar overhead desnecessário no banco.
  const atualizarProgresso = async (payload: {
    etapa_atual?: EtapaImportacaoBackend;
    status_processamento?: "processando" | "finalizado" | "erro";
    linhas_processadas?: number;
    inseridos?: number;
    atualizados?: number;
    ignorados?: number;
    erros?: number;
    force?: boolean;
  }) => {
    if (!importacaoId) return;
    const agora = Date.now();
    const force = payload.force ?? false;
    if (!force && agora - ultimoUpdateProgresso < 400) return;
    ultimoUpdateProgresso = agora;

    const { force: _, ...updatePayload } = payload;
    await supabase
      .from("importacoes")
      .update(updatePayload)
      .eq("id", importacaoId)
      .then(() => {}, () => {});
  };

  try {
    const body: RequestBody = await req.json();

    if (!body.nome_arquivo || !Array.isArray(body.linhas) || body.linhas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requisição inválida: nome_arquivo e linhas são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.layout_tem_data_mapeada === false) {
      console.warn("[IMPORTACAO] Layout base sem campo de data mapeado");
    }

    // === LOCK: verifica + libera órfão (>5min) + adquire ===
    await atualizarProgresso({ etapa_atual: "validando_lock", status_processamento: "processando", force: true });
    const { data: lockData, error: lockError } = await supabase
      .from("import_lock").select("*").eq("id", 1).single();
    if (lockError) throw new Error(`Erro ao verificar lock: ${lockError.message}`);

    if (lockData.locked) {
      const lockedAt = lockData.locked_at ? new Date(lockData.locked_at).getTime() : 0;
      const idadeMin = (Date.now() - lockedAt) / 60000;
      if (idadeMin < LOCK_TIMEOUT_MIN) {
        return new Response(
          JSON.stringify({ error: `Já existe uma importação em andamento (iniciada há ${idadeMin.toFixed(1)} min). Aguarde a conclusão ou tente novamente em ${(LOCK_TIMEOUT_MIN - idadeMin).toFixed(1)} min.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Lock órfão → marcar importação anterior como falhou
      if (lockData.importacao_id) {
        await supabase.from("importacoes")
          .update({ status: "falhou" })
          .eq("id", lockData.importacao_id)
          .eq("status", "em_andamento");
      }
    }

    // Cria registro de importação
    const { data: importacao, error: impError } = await supabase
      .from("importacoes")
      .insert({
        tipo: "base",
        nome_arquivo: body.nome_arquivo,
        total_linhas: body.linhas.length,
        status: "em_andamento",
        status_processamento: "processando",
        etapa_atual: "iniciando",
        linhas_processadas: 0,
        inseridos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: 0,
      })
      .select("id").single();
    if (impError) throw new Error(`Erro ao criar importação: ${impError.message}`);
    importacaoId = importacao.id;

    // Adquire lock
    const { error: lockAcquireError } = await supabase
      .from("import_lock")
      .update({ locked: true, locked_at: new Date().toISOString(), importacao_id: importacaoId })
      .eq("id", 1);
    if (lockAcquireError) throw new Error(`Erro ao adquirir lock: ${lockAcquireError.message}`);
    lockAdquirido = true;
    // O importacao_id nasce aqui e passa a ser a referência única para polling no frontend.
    await atualizarProgresso({ etapa_atual: "normalizando_dados", status_processamento: "processando", force: true });

    // === Normalização em memória ===
    type LinhaProcessada = {
      chave: string;
      contrato: string;
      nota: string;
      placa: string | null;
      data: string | null;
      dados: Record<string, unknown>;
    };
    const processadas: LinhaProcessada[] = [];
    const chavesVistas = new Set<string>();
    let erros = 0;
    let primeiroErro: string | null = null;
    const PROGRESSO_PASSO_LINHAS = 500;

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
      if (chavesVistas.has(chave)) continue; // duplicata dentro do mesmo arquivo → mantém primeira
      chavesVistas.add(chave);
      processadas.push({
        chave,
        contrato: contratoNorm,
        nota: notaNorm,
        placa: normalizarPlaca(linha.placa),
        data: sanitizarDataReferencia(linha.data),
        dados: linha.dados_originais || {},
      });

      if ((i + 1) % PROGRESSO_PASSO_LINHAS === 0 || i === body.linhas.length - 1) {
        await atualizarProgresso({
          etapa_atual: "normalizando_dados",
          linhas_processadas: i + 1,
          erros,
        });
      }
    }
    await atualizarProgresso({ etapa_atual: "classificando_registros", linhas_processadas: body.linhas.length, erros, force: true });

    // === BATCH SELECT: busca registros existentes pelas chaves ===
    const todasChaves = processadas.map(p => p.chave);
    const existentesMap = new Map<string, {
      id: string;
      contrato_vinculado: string;
      nota_fiscal: string;
      placa_normalizada: string | null;
      data_referencia: string | null;
      dados_originais: Record<string, unknown> | null;
    }>();

    // Chunk pequeno: cada chave ~14 chars vira ~30 chars URL-encoded; 150 keys ≈ 5KB de URL (limite seguro do PostgREST)
    for (const chunkChaves of chunk(todasChaves, 150)) {
      const { data: existentes, error: selErr } = await supabase
        .from("registros_base")
        .select("id, chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada, data_referencia, dados_originais")
        .in("chave_normalizada", chunkChaves);
      if (selErr) throw new Error(`Erro ao buscar registros existentes: ${selErr.message}`);
      for (const r of existentes || []) existentesMap.set(r.chave_normalizada, r);
    }

    // === Classifica em inserir / atualizar / ignorar ===
    const paraInserir: Array<Record<string, unknown>> = [];
    const paraAtualizar: Array<{ id: string; chave: string; payload: Record<string, unknown> }> = [];
    let ignorados = 0;

    for (const p of processadas) {
      const existente = existentesMap.get(p.chave);
      if (!existente) {
        paraInserir.push({
          chave_normalizada: p.chave,
          contrato_vinculado: p.contrato,
          nota_fiscal: p.nota,
          placa_normalizada: p.placa,
          data_referencia: p.data,
          dados_originais: p.dados,
          ultima_importacao_id: importacaoId,
        });
      } else {
        // Regra crítica PRD: matching/status dependem somente dos campos estruturais normalizados.
        // Campos informativos (data/dados_originais) podem ser atualizados sem alterar semântica do matching.
        const mudouEstrutural =
          existente.contrato_vinculado !== p.contrato ||
          existente.nota_fiscal !== p.nota ||
          (existente.placa_normalizada || null) !== (p.placa || null);
        const dadosOriginaisAtuais = (existente.dados_originais && typeof existente.dados_originais === "object")
          ? existente.dados_originais
          : {};
        const mudouContextoInformativo =
          (existente.data_referencia || null) !== (p.data || null) ||
          // Comparação determinística para preservar idempotência quando a ordem das chaves do JSON variar.
          stableJsonStringify(dadosOriginaisAtuais) !== stableJsonStringify(p.dados || {});

        // A data da Base (GRL053) é campo informativo da conferência e precisa refletir a carga atual.
        // Por isso, atualizamos também quando só contexto informativo mudou, sem mexer no motor de matching.
        if (mudouEstrutural || mudouContextoInformativo) {
          paraAtualizar.push({
            id: existente.id,
            chave: p.chave,
            payload: {
              ...(mudouEstrutural ? {
                contrato_vinculado: p.contrato,
                nota_fiscal: p.nota,
                placa_normalizada: p.placa,
              } : {}),
              data_referencia: p.data,
              dados_originais: p.dados,
              ultima_importacao_id: importacaoId,
            },
          });
        } else {
          ignorados++;
        }
      }
    }
    await atualizarProgresso({
      etapa_atual: "persistindo_registros",
      linhas_processadas: body.linhas.length,
      ignorados,
      erros,
      force: true,
    });

    // === BATCH INSERT registros_base ===
    let inseridos = 0;
    for (const lote of chunk(paraInserir, 500)) {
      const { error: insErr } = await supabase.from("registros_base").insert(lote);
      if (insErr) throw new Error(`Erro no insert em lote (${lote.length} linhas): ${insErr.message}`);
      inseridos += lote.length;
      await atualizarProgresso({ etapa_atual: "persistindo_registros", inseridos, atualizados: 0, ignorados, erros });
    }

    // === UPDATEs (não há bulk update no PostgREST; faz por id em paralelo controlado) ===
    let atualizados = 0;
    const UPDATE_CONCURRENCY = 20;
    for (const lote of chunk(paraAtualizar, UPDATE_CONCURRENCY)) {
      const results = await Promise.all(
        lote.map(({ id, payload }) =>
          supabase.from("registros_base").update(payload).eq("id", id)
        )
      );
      for (const r of results) {
        if (r.error) {
          erros++;
          if (!primeiroErro) primeiroErro = `Erro ao atualizar registro: ${r.error.message}`;
        } else {
          atualizados++;
        }
      }
      await atualizarProgresso({ etapa_atual: "persistindo_registros", inseridos, atualizados, ignorados, erros });
    }

    // Reprocessa somente as chaves afetadas (insert/update), conforme PRD de reprocessamento incremental.
    // O status/motivo é materializado no backend para manter frontend apenas como leitura.
    const chavesAfetadas = [
      ...new Set<string>([
        ...paraInserir.map((r) => String(r.chave_normalizada)),
        ...paraAtualizar.map(({ chave }) => chave),
      ].filter(Boolean)),
    ];

    if (chavesAfetadas.length > 0) {
      await atualizarProgresso({ etapa_atual: "atualizando_conferencia", inseridos, atualizados, ignorados, erros, force: true });
      await recalcularConferenciaPorChaves(supabase, chavesAfetadas);
    }

    // Resumo de status da conferência para as chaves processadas nesta importação.
    // Isso evita números inventados no frontend e reflete o estado materializado após o processamento.
    const chavesProcessadas = [...new Set(processadas.map((p) => p.chave))];
    let vinculados = 0;
    let aguardando = 0;
    let divergentes = 0;
    let ambiguos = 0;
    for (const chunkChaves of chunk(chavesProcessadas, 500)) {
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
    await atualizarProgresso({ etapa_atual: "consolidando_resultado", inseridos, atualizados, ignorados, erros, force: true });

    // === Finaliza importação ===
    await supabase
      .from("importacoes")
      .update({
        inseridos,
        atualizados,
        ignorados,
        erros,
        linhas_processadas: body.linhas.length,
        etapa_atual: "finalizando_importacao",
        status_processamento: "finalizado",
        status: "concluida",
      })
      .eq("id", importacaoId);

    // === Libera lock ===
    await supabase.from("import_lock")
      .update({ locked: false, locked_at: null, importacao_id: null })
      .eq("id", 1);

    return new Response(JSON.stringify({
      importacao_id: importacaoId,
      total_linhas: body.linhas.length,
      inseridos,
      atualizados,
      ignorados,
      vinculados,
      aguardando,
      divergentes,
      ambiguos,
      erros,
      primeiro_erro: primeiroErro,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno desconhecido";

    // Tenta marcar importação como falhou
    if (importacaoId) {
      await supabase.from("importacoes")
        .update({
          status: "falhou",
          status_processamento: "erro",
          etapa_atual: "erro",
        })
        .eq("id", importacaoId)
        .then(() => {}, () => {});
    }
    // Libera lock se foi adquirido
    if (lockAdquirido) {
      await supabase.from("import_lock")
        .update({ locked: false, locked_at: null, importacao_id: null })
        .eq("id", 1)
        .then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
