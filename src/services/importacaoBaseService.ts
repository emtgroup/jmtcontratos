import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaParseada, ResumoImportacao, ProgressoImportacaoBase } from "@/types/importacao";

// Tipos lógicos obrigatórios do layout base (regra do PRD)
const TIPOS_OBRIGATORIOS = ["contrato_vinculado", "nota_fiscal"] as const;
const TIPO_PLACA = "placa";

// Normaliza tipo_coluna: "Contrato vinculado" → "contrato_vinculado"
function normalizaTipo(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

// Normaliza texto de cabeçalho para comparação
function normalizaHeader(s: string): string {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

// Converte letra Excel (A, B, ..., Z, AA, AB, ...) em índice 0-based
function letraParaIndice(letra: string): number {
  const up = letra.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(up)) return -1;
  let result = 0;
  for (let i = 0; i < up.length; i++) {
    result = result * 26 + (up.charCodeAt(i) - 64);
  }
  return result - 1;
}

interface LayoutResolvido {
  layoutId: string;
  origemLayout: "base" | "complementar";
  nomeLayout: string;
  linhaCabecalho: number;
  linhaDados: number;
  colunas: Array<{
    tipoNormalizado: string;
    nomeExcel: string;
  }>;
}

interface LayoutComIndices extends LayoutResolvido {
  indicePorTipo: Map<string, number>;
}

async function carregarLayoutAtivo(): Promise<LayoutResolvido> {
  const { data: layout, error: lErr } = await supabase
    .from("layouts_base")
    .select("id, linha_cabecalho, linha_dados, ativo")
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lErr) throw new Error(`Erro ao carregar layout base: ${lErr.message}`);
  if (!layout) throw new Error("Nenhum layout base ativo encontrado. Configure em /configuracoes.");

  const { data: colunas, error: cErr } = await supabase
    .from("layouts_base_colunas")
    .select("tipo_coluna, nome_coluna_excel, ordem")
    .eq("layout_base_id", layout.id)
    .order("ordem", { ascending: true });

  if (cErr) throw new Error(`Erro ao carregar colunas do layout: ${cErr.message}`);
  if (!colunas || colunas.length === 0) {
    throw new Error("Layout base ativo não possui colunas configuradas. Configure em /configuracoes.");
  }

  // Normalizar tipos e validar obrigatórios
  const colunasNorm = colunas.map(c => ({
    tipoNormalizado: normalizaTipo(c.tipo_coluna),
    nomeExcel: c.nome_coluna_excel,
  }));

  const contagem = new Map<string, number>();
  for (const c of colunasNorm) contagem.set(c.tipoNormalizado, (contagem.get(c.tipoNormalizado) || 0) + 1);

  for (const tipo of TIPOS_OBRIGATORIOS) {
    const n = contagem.get(tipo) || 0;
    if (n === 0) {
      const tiposEncontrados = [...new Set(colunasNorm.map(c => c.tipoNormalizado))].join(", ");
      throw new Error(`Layout base inválido: tipo "${tipo}" ausente. Tipos configurados: [${tiposEncontrados}]`);
    }
    if (n > 1) throw new Error(`Layout base inválido: tipo "${tipo}" duplicado (${n} colunas).`);
  }

  return {
    layoutId: layout.id,
    origemLayout: "base",
    nomeLayout: "GRL053",
    linhaCabecalho: layout.linha_cabecalho,
    linhaDados: layout.linha_dados,
    colunas: colunasNorm,
  };
}

function resolverIndices(layout: LayoutResolvido, headerRow: unknown[]): LayoutComIndices {
  const headersNorm = headerRow.map(h => normalizaHeader(String(h ?? "")));
  const indicePorTipo = new Map<string, number>();

  for (const col of layout.colunas) {
    const nomeNorm = normalizaHeader(col.nomeExcel);

    // Tentar encontrar pelo nome do cabeçalho
    let idx = headersNorm.indexOf(nomeNorm);

    // Fallback: se parece letra Excel (A, B, AA...) e não achou como header, usar como letra
    if (idx === -1 && /^[A-Z]+$/.test(col.nomeExcel.trim().toUpperCase())) {
      idx = letraParaIndice(col.nomeExcel);
    }

    if (idx === -1) {
      const disponiveis = headersNorm.filter(h => h.length > 0).join(", ");
      throw new Error(
        `Coluna "${col.nomeExcel}" (${col.tipoNormalizado}) não encontrada no cabeçalho da linha ${layout.linhaCabecalho} do layout ${layout.origemLayout} "${layout.nomeLayout}". Cabeçalhos disponíveis: [${disponiveis}]`
      );
    }

    indicePorTipo.set(col.tipoNormalizado, idx);
  }

  return { ...layout, indicePorTipo };
}

export async function parseExcelFile(file: File, layout: LayoutResolvido): Promise<LinhaParseada[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rawData.length < layout.linhaDados) {
    throw new Error(`Arquivo possui ${rawData.length} linhas, mas o layout exige dados a partir da linha ${layout.linhaDados}.`);
  }

  // O parser sempre usa a linha de cabeçalho definida no layout salvo (base ou complementar).
  const headerRow = (rawData[layout.linhaCabecalho - 1] || []) as unknown[];
  const resolved = resolverIndices(layout, headerRow);

  // O parser sempre começa os dados na linha definida no layout salvo (base ou complementar).
  const dataRows = rawData.slice(layout.linhaDados - 1);
  const contratoIdx = resolved.indicePorTipo.get("contrato_vinculado")!;
  const notaIdx = resolved.indicePorTipo.get("nota_fiscal")!;
  const placaIdx = resolved.indicePorTipo.get(TIPO_PLACA);

  const linhas: LinhaParseada[] = [];
  for (const row of dataRows) {
    const contrato = String(row[contratoIdx] ?? "").trim();
    const nota = String(row[notaIdx] ?? "").trim();
    if (!contrato || !nota) continue;

    const dados_originais: Record<string, unknown> = {};
    headerRow.forEach((header, idx) => {
      const h = String(header ?? "").trim();
      if (h && row[idx] !== undefined && row[idx] !== "") {
        dados_originais[h] = row[idx];
      }
    });

    linhas.push({
      contrato_vinculado: contrato,
      nota_fiscal: nota,
      placa: placaIdx !== undefined ? String(row[placaIdx] ?? "").trim() || undefined : undefined,
      dados_originais,
    });
  }

  return linhas;
}

export type EtapaProgresso = "validando" | "lendo" | "enviando" | "processando_servidor" | "finalizando";
export type OnEtapa = (etapa: EtapaProgresso) => void;
export type OnTotalPreparado = (total: number) => void;

export interface EstadoBaseConsolidada {
  total_registros_base: number;
  total_vinculados: number;
  total_aguardando: number;
  total_divergentes: number;
  total_ambiguos: number;
}

async function contarTabela(nomeTabela: "registros_base" | "conferencia"): Promise<number> {
  const { count, error } = await supabase
    .from(nomeTabela)
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`Erro ao contar ${nomeTabela}: ${error.message}`);
  return count ?? 0;
}

async function contarStatus(status: "vinculado" | "aguardando" | "divergente" | "ambiguo"): Promise<number> {
  const { count, error } = await supabase
    .from("conferencia")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw new Error(`Erro ao contar conferência (${status}): ${error.message}`);
  return count ?? 0;
}

export async function carregarEstadoBaseConsolidada(): Promise<EstadoBaseConsolidada> {
  // Estes números são do estado consolidado atual do banco (não da última execução de importação).
  const [
    totalBase,
    totalVinculados,
    totalAguardando,
    totalDivergentes,
    totalAmbiguos,
  ] = await Promise.all([
    contarTabela("registros_base"),
    contarStatus("vinculado"),
    contarStatus("aguardando"),
    contarStatus("divergente"),
    contarStatus("ambiguo"),
  ]);

  return {
    total_registros_base: totalBase,
    total_vinculados: totalVinculados,
    total_aguardando: totalAguardando,
    total_divergentes: totalDivergentes,
    total_ambiguos: totalAmbiguos,
  };
}

export async function importarBase(file: File, onEtapa?: OnEtapa, onTotalPreparado?: OnTotalPreparado): Promise<ResumoImportacao> {
  onEtapa?.("validando");
  const layout = await carregarLayoutAtivo();

  onEtapa?.("lendo");
  const linhas = await parseExcelFile(file, layout);
  if (linhas.length === 0) {
    throw new Error("Nenhuma linha operacional válida encontrada no arquivo (verifique linha de dados e colunas obrigatórias).");
  }
  onTotalPreparado?.(linhas.length);

  onEtapa?.("enviando");
  // O backend processa em lote no servidor; não há métrica contínua confiável para percentual em tempo real.
  onEtapa?.("processando_servidor");
  const { data, error } = await supabase.functions.invoke("importar-base", {
    body: { nome_arquivo: file.name, linhas },
  });
  onEtapa?.("finalizando");

  if (error) {
    let detalhe = error.message || "Erro desconhecido na função";
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (ctx?.json) {
        const body = await ctx.json();
        if (body?.error) detalhe = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(detalhe);
  }
  if (data?.error) throw new Error(data.error);

  return data as ResumoImportacao;
}

// ============================================================
// IMPORTAÇÃO COMPLEMENTAR
// ============================================================

export interface LayoutComplementarResumo {
  id: string;
  nome: string;
}

export async function listarLayoutsComplementaresAtivos(): Promise<LayoutComplementarResumo[]> {
  const { data, error } = await supabase
    .from("layouts_complementares")
    .select("id, nome, created_at")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Erro ao listar layouts complementares: ${error.message}`);
  // Evita seleção ambígua na importação quando existir mais de um layout ativo com o mesmo nome.
  // Mantemos o mais recente por nome para garantir que a importação use a configuração mais atual.
  const maisRecentePorNome = new Map<string, LayoutComplementarResumo>();
  for (const l of data || []) {
    if (!maisRecentePorNome.has(l.nome)) {
      maisRecentePorNome.set(l.nome, { id: l.id, nome: l.nome });
    }
  }

  return [...maisRecentePorNome.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

async function carregarLayoutComplementarAtivo(layoutId: string): Promise<LayoutResolvido> {
  const { data: layout, error: lErr } = await supabase
    .from("layouts_complementares")
    .select("id, nome, linha_cabecalho, linha_dados, ativo")
    .eq("id", layoutId)
    .maybeSingle();

  if (lErr) throw new Error(`Erro ao carregar layout complementar: ${lErr.message}`);
  if (!layout) throw new Error("Layout complementar não encontrado.");
  if (!layout.ativo) throw new Error(`Layout complementar "${layout.nome}" está inativo.`);

  const { data: colunas, error: cErr } = await supabase
    .from("layouts_complementares_colunas")
    .select("tipo_coluna, nome_coluna_excel, ordem")
    .eq("layout_complementar_id", layout.id)
    .order("ordem", { ascending: true });

  if (cErr) throw new Error(`Erro ao carregar colunas do layout complementar: ${cErr.message}`);
  if (!colunas || colunas.length === 0) {
    throw new Error(`Layout complementar "${layout.nome}" não possui colunas configuradas.`);
  }

  const colunasNorm = colunas.map((c) => ({
    tipoNormalizado: normalizaTipo(c.tipo_coluna),
    nomeExcel: c.nome_coluna_excel,
  }));

  const contagem = new Map<string, number>();
  for (const c of colunasNorm) contagem.set(c.tipoNormalizado, (contagem.get(c.tipoNormalizado) || 0) + 1);

  for (const tipo of TIPOS_OBRIGATORIOS) {
    const n = contagem.get(tipo) || 0;
    if (n === 0) {
      const tiposEncontrados = [...new Set(colunasNorm.map((c) => c.tipoNormalizado))].join(", ");
      throw new Error(
        `Layout complementar "${layout.nome}" inválido: tipo "${tipo}" ausente. Tipos configurados: [${tiposEncontrados}]`,
      );
    }
    if (n > 1) {
      throw new Error(`Layout complementar "${layout.nome}" inválido: tipo "${tipo}" duplicado (${n} colunas).`);
    }
  }

  return {
    layoutId: layout.id,
    origemLayout: "complementar",
    nomeLayout: layout.nome,
    linhaCabecalho: layout.linha_cabecalho,
    linhaDados: layout.linha_dados,
    colunas: colunasNorm,
  };
}

export async function importarComplementar(
  file: File,
  layoutComplementarId: string,
  onEtapa?: OnEtapa,
  onTotalPreparado?: OnTotalPreparado,
): Promise<ResumoImportacao> {
  if (!layoutComplementarId) throw new Error("Selecione um layout complementar antes de importar.");

  onEtapa?.("validando");
  // No fluxo complementar, o mapeamento vem exclusivamente do layout complementar salvo
  // (tipo -> nome_coluna_excel), sem depender de nomes fixos do layout base.
  const layout = await carregarLayoutComplementarAtivo(layoutComplementarId);

  onEtapa?.("lendo");
  const linhas = await parseExcelFile(file, layout);
  if (linhas.length === 0) {
    throw new Error("Nenhuma linha operacional válida encontrada no arquivo (verifique linha de dados e colunas obrigatórias).");
  }
  onTotalPreparado?.(linhas.length);

  onEtapa?.("enviando");
  onEtapa?.("processando_servidor");
  const { data, error } = await supabase.functions.invoke("importar-complementar", {
    body: {
      layout_complementar_id: layoutComplementarId,
      nome_arquivo: file.name,
      linhas,
    },
  });
  onEtapa?.("finalizando");

  if (error) {
    let detalhe = error.message || "Erro desconhecido na função";
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (ctx?.json) {
        const body = await ctx.json();
        if (body?.error) detalhe = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(detalhe);
  }
  if (data?.error) throw new Error(data.error);

  return data as ResumoImportacao;
}

export async function buscarProgressoImportacaoBaseAtiva(): Promise<ProgressoImportacaoBase | null> {
  // Polling leve: descobrimos o importacao_id ativo via lock e depois lemos a telemetria real na tabela importacoes.
  const { data: lock, error: lockError } = await supabase
    .from("import_lock")
    .select("locked, importacao_id")
    .eq("id", 1)
    .single();

  if (lockError) throw new Error(`Erro ao consultar lock de importação: ${lockError.message}`);
  if (!lock?.locked || !lock.importacao_id) return null;

  const { data: progresso, error: progressoError } = await supabase
    .from("importacoes")
    .select("id, status_processamento, etapa_atual, total_linhas, linhas_processadas, inseridos, atualizados, ignorados, erros, updated_at, tipo")
    .eq("id", lock.importacao_id)
    .maybeSingle();

  if (progressoError) throw new Error(`Erro ao consultar progresso da importação: ${progressoError.message}`);
  if (!progresso || progresso.tipo !== "base") return null;

  return {
    importacao_id: progresso.id,
    status_processamento: progresso.status_processamento as ProgressoImportacaoBase["status_processamento"],
    etapa_atual: progresso.etapa_atual,
    total_linhas: progresso.total_linhas,
    linhas_processadas: progresso.linhas_processadas,
    inseridos: progresso.inseridos,
    atualizados: progresso.atualizados,
    ignorados: progresso.ignorados,
    erros: progresso.erros,
    updated_at: progresso.updated_at,
  };
}

// Fallback manual para destravar lock órfão (>5 min)
export async function liberarLockOrfao(): Promise<boolean> {
  const { data: lock } = await supabase.from("import_lock").select("locked, locked_at").eq("id", 1).single();
  if (!lock?.locked) return false;
  const idadeMin = lock.locked_at ? (Date.now() - new Date(lock.locked_at).getTime()) / 60000 : 999;
  if (idadeMin < 5) {
    throw new Error(`Lock ainda ativo há ${idadeMin.toFixed(1)} min. Só pode liberar manualmente após 5 min.`);
  }
  const { error } = await supabase.from("import_lock")
    .update({ locked: false, locked_at: null, importacao_id: null })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  return true;
}


export type EscopoLimpezaImportacao = "base_conferencia" | "complementares_conferencia" | "tudo";

interface ResumoLimpezaImportacao {
  escopo: EscopoLimpezaImportacao;
  registros_base_removidos: number;
  registros_complementares_removidos: number;
  conferencia_removida: number;
  importacoes_removidas: number;
}

async function limparDadosImportadosViaBanco(escopo: EscopoLimpezaImportacao): Promise<ResumoLimpezaImportacao> {
  const { data: lock, error: lockError } = await supabase
    .from("import_lock")
    .select("locked")
    .eq("id", 1)
    .single();

  if (lockError) throw new Error(`Erro ao verificar lock: ${lockError.message}`);
  if (lock?.locked) throw new Error("Existe uma importação em andamento. Aguarde a conclusão para executar a limpeza.");

  const resumo: ResumoLimpezaImportacao = {
    escopo,
    registros_base_removidos: 0,
    registros_complementares_removidos: 0,
    conferencia_removida: 0,
    importacoes_removidas: 0,
  };

  if (escopo === "base_conferencia" || escopo === "tudo") {
    const { count, error } = await supabase.from("registros_base").delete({ count: "exact" }).not("id", "is", null);
    if (error) throw new Error(`Erro ao limpar registros base: ${error.message}`);
    resumo.registros_base_removidos = count ?? 0;
  }

  if (escopo === "complementares_conferencia" || escopo === "tudo") {
    const { count, error } = await supabase.from("registros_complementares").delete({ count: "exact" }).not("id", "is", null);
    if (error) throw new Error(`Erro ao limpar registros complementares: ${error.message}`);
    resumo.registros_complementares_removidos = count ?? 0;
  }

  // Mesmo sem registros na conferência, limpamos para garantir estado consistente após limpeza explícita.
  const { count: conferenciaCount, error: conferenciaError } = await supabase
    .from("conferencia")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (conferenciaError) throw new Error(`Erro ao limpar conferência: ${conferenciaError.message}`);
  resumo.conferencia_removida = conferenciaCount ?? 0;

  return resumo;
}

export async function limparDadosImportados(escopo: EscopoLimpezaImportacao): Promise<ResumoLimpezaImportacao> {
  try {
    const { data, error } = await supabase.functions.invoke("limpar-dados-importados", {
      body: { escopo },
    });

    if (error) {
      let detalhe = error.message || "Erro desconhecido na função de limpeza";
      try {
        const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        if (ctx?.json) {
          const body = await ctx.json();
          if (body?.error) detalhe = body.error;
        }
      } catch { /* ignore */ }
      throw new Error(detalhe);
    }

    if (data?.error) throw new Error(data.error);
    return data as ResumoLimpezaImportacao;
  } catch {
    // Fallback seguro: mantém limpeza explícita mesmo quando a Edge Function ainda não está disponível no ambiente.
    return limparDadosImportadosViaBanco(escopo);
  }
}
