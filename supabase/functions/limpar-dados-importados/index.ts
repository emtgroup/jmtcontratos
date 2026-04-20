import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EscopoLimpeza = "base_conferencia" | "complementares_conferencia" | "tudo";

interface RequestBody {
  escopo: EscopoLimpeza;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body: RequestBody = await req.json();
    const escopo = body.escopo;

    if (!["base_conferencia", "complementares_conferencia", "tudo"].includes(escopo)) {
      return new Response(JSON.stringify({ error: "Escopo de limpeza inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lockData, error: lockError } = await supabase
      .from("import_lock")
      .select("locked")
      .eq("id", 1)
      .single();

    if (lockError) throw new Error(`Erro ao verificar lock: ${lockError.message}`);
    if (lockData?.locked) {
      return new Response(
        JSON.stringify({ error: "Existe uma importação em andamento. Aguarde a conclusão para executar a limpeza." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resposta = {
      escopo,
      registros_base_removidos: 0,
      registros_complementares_removidos: 0,
      conferencia_removida: 0,
      importacoes_removidas: 0,
    };

    if (escopo === "base_conferencia" || escopo === "tudo") {
      const { count, error } = await supabase
        .from("registros_base")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`Erro ao limpar registros base: ${error.message}`);
      resposta.registros_base_removidos = count ?? 0;
    }

    if (escopo === "complementares_conferencia" || escopo === "tudo") {
      const { count, error } = await supabase
        .from("registros_complementares")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`Erro ao limpar registros complementares: ${error.message}`);
      resposta.registros_complementares_removidos = count ?? 0;
    }

    // A conferência precisa ser limpa junto para evitar status materializado sem origem operacional.
    const { count: conferenciaCount, error: conferenciaError } = await supabase
      .from("conferencia")
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (conferenciaError) throw new Error(`Erro ao limpar conferência: ${conferenciaError.message}`);
    resposta.conferencia_removida = conferenciaCount ?? 0;

    return new Response(JSON.stringify(resposta), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
