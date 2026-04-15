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

function normalizarContrato(raw: string): string {
  // Remove non-numeric except hyphen, take first block before hyphen, keep only digits
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: RequestBody = await req.json();

    if (!body.nome_arquivo || !Array.isArray(body.linhas) || body.linhas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requisição inválida: nome_arquivo e linhas são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === LOCK: Check and acquire ===
    const { data: lockData, error: lockError } = await supabase
      .from("import_lock")
      .select("*")
      .eq("id", 1)
      .single();

    if (lockError) throw new Error(`Erro ao verificar lock: ${lockError.message}`);

    if (lockData.locked) {
      return new Response(
        JSON.stringify({ error: "Já existe uma importação em andamento. Aguarde a conclusão." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Create importacao record ===
    const { data: importacao, error: impError } = await supabase
      .from("importacoes")
      .insert({
        tipo: "base",
        nome_arquivo: body.nome_arquivo,
        total_linhas: body.linhas.length,
        status: "em_andamento",
      })
      .select("id")
      .single();

    if (impError) throw new Error(`Erro ao criar importação: ${impError.message}`);

    // === Acquire lock ===
    const { error: lockAcquireError } = await supabase
      .from("import_lock")
      .update({ locked: true, locked_at: new Date().toISOString(), importacao_id: importacao.id })
      .eq("id", 1);

    if (lockAcquireError) throw new Error(`Erro ao adquirir lock: ${lockAcquireError.message}`);

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;
    let erros = 0;

    for (const linha of body.linhas) {
      try {
        const contratoNorm = normalizarContrato(linha.contrato_vinculado);
        const notaNorm = normalizarNota(linha.nota_fiscal);

        if (!contratoNorm || !notaNorm) {
          erros++;
          continue;
        }

        const placaNorm = normalizarPlaca(linha.placa);
        const chave = gerarChave(contratoNorm, notaNorm);

        // Check if record exists
        const { data: existing } = await supabase
          .from("registros_base")
          .select("id, contrato_vinculado, nota_fiscal, placa_normalizada, dados_originais")
          .eq("chave_normalizada", chave)
          .maybeSingle();

        if (!existing) {
          // INSERT
          const { error: insertError } = await supabase.from("registros_base").insert({
            chave_normalizada: chave,
            contrato_vinculado: contratoNorm,
            nota_fiscal: notaNorm,
            placa_normalizada: placaNorm,
            dados_originais: linha.dados_originais,
            ultima_importacao_id: importacao.id,
          });
          if (insertError) { erros++; continue; }
          inseridos++;

          // Upsert conferencia
          await supabase.from("conferencia").upsert(
            { chave_normalizada: chave, status: "aguardando" },
            { onConflict: "chave_normalizada" }
          );
        } else {
          // Compare normalized fields + dados_originais using deep equality
          const dadosOrigStr = JSON.stringify(linha.dados_originais, Object.keys(linha.dados_originais).sort());
          const existingOrigStr = JSON.stringify(existing.dados_originais, 
            typeof existing.dados_originais === 'object' && existing.dados_originais !== null 
              ? Object.keys(existing.dados_originais as Record<string, unknown>).sort() 
              : undefined);
          
          const dadosChanged =
            existing.contrato_vinculado !== contratoNorm ||
            existing.nota_fiscal !== notaNorm ||
            (existing.placa_normalizada || null) !== (placaNorm || null) ||
            dadosOrigStr !== existingOrigStr;

          if (dadosChanged) {
            // UPDATE
            const { error: updateError } = await supabase
              .from("registros_base")
              .update({
                contrato_vinculado: contratoNorm,
                nota_fiscal: notaNorm,
                placa_normalizada: placaNorm,
                dados_originais: linha.dados_originais,
                ultima_importacao_id: importacao.id,
              })
              .eq("id", existing.id);
            if (updateError) { erros++; continue; }
            atualizados++;
          } else {
            ignorados++;
          }
        }
      } catch {
        erros++;
      }
    }

    // === Finalize importacao ===
    await supabase
      .from("importacoes")
      .update({
        inseridos,
        atualizados,
        ignorados,
        status: "concluida",
      })
      .eq("id", importacao.id);

    // === Release lock ===
    await supabase
      .from("import_lock")
      .update({ locked: false, locked_at: null, importacao_id: null })
      .eq("id", 1);

    const resumo = {
      importacao_id: importacao.id,
      total_linhas: body.linhas.length,
      inseridos,
      atualizados,
      ignorados,
      erros,
    };

    return new Response(JSON.stringify(resumo), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Release lock on error
    await supabase
      .from("import_lock")
      .update({ locked: false, locked_at: null, importacao_id: null })
      .eq("id", 1);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
