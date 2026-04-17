import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinhaParseada {
  contrato_vinculado: string;
  nota_fiscal: string;
  placa?: string;
  dados_originais: Record<string, unknown>;
}

interface RequestBody {
  nome_arquivo: string;
  linhas: LinhaParseada[];
}

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

// Compara dados_originais de forma estável
function jsonEstavel(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return JSON.stringify(obj, keys);
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

  try {
    const body: RequestBody = await req.json();

    if (!body.nome_arquivo || !Array.isArray(body.linhas) || body.linhas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requisição inválida: nome_arquivo e linhas são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === LOCK: verifica + libera órfão (>5min) + adquire ===
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
      .insert({ tipo: "base", nome_arquivo: body.nome_arquivo, total_linhas: body.linhas.length, status: "em_andamento" })
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
      if (chavesVistas.has(chave)) continue; // duplicata dentro do mesmo arquivo → mantém primeira
      chavesVistas.add(chave);
      processadas.push({
        chave,
        contrato: contratoNorm,
        nota: notaNorm,
        placa: normalizarPlaca(linha.placa),
        dados: linha.dados_originais || {},
      });
    }

    // === BATCH SELECT: busca registros existentes pelas chaves ===
    const todasChaves = processadas.map(p => p.chave);
    const existentesMap = new Map<string, { id: string; contrato_vinculado: string; nota_fiscal: string; placa_normalizada: string | null; dados_originais: unknown }>();

    // Chunk pequeno: cada chave ~14 chars vira ~30 chars URL-encoded; 150 keys ≈ 5KB de URL (limite seguro do PostgREST)
    for (const chunkChaves of chunk(todasChaves, 150)) {
      const { data: existentes, error: selErr } = await supabase
        .from("registros_base")
        .select("id, chave_normalizada, contrato_vinculado, nota_fiscal, placa_normalizada, dados_originais")
        .in("chave_normalizada", chunkChaves);
      if (selErr) throw new Error(`Erro ao buscar registros existentes: ${selErr.message}`);
      for (const r of existentes || []) existentesMap.set(r.chave_normalizada, r);
    }

    // === Classifica em inserir / atualizar / ignorar ===
    const paraInserir: Array<Record<string, unknown>> = [];
    const paraAtualizar: Array<{ id: string; payload: Record<string, unknown> }> = [];
    let ignorados = 0;

    for (const p of processadas) {
      const existente = existentesMap.get(p.chave);
      if (!existente) {
        paraInserir.push({
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
          (existente.placa_normalizada || null) !== (p.placa || null) ||
          jsonEstavel(existente.dados_originais) !== jsonEstavel(p.dados);
        if (mudou) {
          paraAtualizar.push({
            id: existente.id,
            payload: {
              contrato_vinculado: p.contrato,
              nota_fiscal: p.nota,
              placa_normalizada: p.placa,
              dados_originais: p.dados,
              ultima_importacao_id: importacaoId,
            },
          });
        } else {
          ignorados++;
        }
      }
    }

    // === BATCH INSERT registros_base ===
    let inseridos = 0;
    for (const lote of chunk(paraInserir, 500)) {
      const { error: insErr } = await supabase.from("registros_base").insert(lote);
      if (insErr) throw new Error(`Erro no insert em lote (${lote.length} linhas): ${insErr.message}`);
      inseridos += lote.length;
    }

    // === BATCH UPSERT conferencia (apenas chaves novas, status aguardando) ===
    if (paraInserir.length > 0) {
      const confRows = paraInserir.map((r) => ({ chave_normalizada: r.chave_normalizada, status: "aguardando" }));
      for (const lote of chunk(confRows, 500)) {
        const { error: confErr } = await supabase
          .from("conferencia")
          .upsert(lote, { onConflict: "chave_normalizada" });
        if (confErr) throw new Error(`Erro ao atualizar conferencia: ${confErr.message}`);
      }
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
    }

    // === Finaliza importação ===
    await supabase
      .from("importacoes")
      .update({ inseridos, atualizados, ignorados, status: "concluida" })
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
      erros,
      primeiro_erro: primeiroErro,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno desconhecido";

    // Tenta marcar importação como falhou
    if (importacaoId) {
      await supabase.from("importacoes")
        .update({ status: "falhou" })
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
