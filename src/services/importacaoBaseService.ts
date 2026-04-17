import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaParseada, ResumoImportacao } from "@/types/importacao";

// Tipos lógicos obrigatórios do layout base (regra do PRD)
const TIPOS_OBRIGATORIOS = ["contrato_vinculado", "nota_fiscal"] as const;
const TIPO_PLACA = "placa";

// Converte letra Excel (A, B, ..., Z, AA, AB, ...) em índice 0-based
function letraParaIndice(letra: string): number {
  const up = letra.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(up)) {
    throw new Error(`Coluna "${letra}" não é uma letra Excel válida (use A, B, C, ..., AA, AB, etc.)`);
  }
  let result = 0;
  for (let i = 0; i < up.length; i++) {
    result = result * 26 + (up.charCodeAt(i) - 64);
  }
  return result - 1;
}

interface LayoutResolvido {
  layoutId: string;
  linhaCabecalho: number; // 1-based como no banco
  linhaDados: number;     // 1-based
  // tipo_coluna -> índice 0-based no array da linha
  indicePorTipo: Map<string, number>;
  // tipo_coluna -> letra original (para mensagens de erro)
  letraPorTipo: Map<string, string>;
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

  // Validar tipos obrigatórios (exatamente 1 de cada)
  const contagem = new Map<string, number>();
  for (const c of colunas) contagem.set(c.tipo_coluna, (contagem.get(c.tipo_coluna) || 0) + 1);
  for (const tipo of TIPOS_OBRIGATORIOS) {
    const n = contagem.get(tipo) || 0;
    if (n === 0) throw new Error(`Layout base inválido: tipo "${tipo}" ausente.`);
    if (n > 1) throw new Error(`Layout base inválido: tipo "${tipo}" duplicado (${n} colunas).`);
  }

  const indicePorTipo = new Map<string, number>();
  const letraPorTipo = new Map<string, string>();
  for (const c of colunas) {
    const idx = letraParaIndice(c.nome_coluna_excel);
    indicePorTipo.set(c.tipo_coluna, idx);
    letraPorTipo.set(c.tipo_coluna, c.nome_coluna_excel.toUpperCase());
  }

  return {
    layoutId: layout.id,
    linhaCabecalho: layout.linha_cabecalho,
    linhaDados: layout.linha_dados,
    indicePorTipo,
    letraPorTipo,
  };
}

export async function parseExcelFile(file: File, layout: LayoutResolvido): Promise<LinhaParseada[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rawData.length < layout.linhaDados) {
    throw new Error(`Arquivo possui ${rawData.length} linhas, mas o layout exige cabeçalho na linha ${layout.linhaCabecalho} e dados a partir da linha ${layout.linhaDados}.`);
  }

  const headerRow = (rawData[layout.linhaCabecalho - 1] || []) as unknown[];
  const dataRows = rawData.slice(layout.linhaDados - 1);

  const contratoIdx = layout.indicePorTipo.get("contrato_vinculado")!;
  const notaIdx = layout.indicePorTipo.get("nota_fiscal")!;
  const placaIdx = layout.indicePorTipo.get(TIPO_PLACA);

  // Valida que as colunas existem na planilha (índice dentro do header)
  const maxColPlanilha = Math.max(headerRow.length, ...dataRows.map(r => r.length)) - 1;
  for (const tipo of TIPOS_OBRIGATORIOS) {
    const idx = layout.indicePorTipo.get(tipo)!;
    if (idx > maxColPlanilha) {
      throw new Error(`Coluna "${layout.letraPorTipo.get(tipo)}" (${tipo}) não existe na planilha — arquivo só vai até a coluna ${maxColPlanilha + 1}.`);
    }
  }

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

export type EtapaProgresso = "lendo" | "validando" | "enviando" | "processando";
export type OnEtapa = (etapa: EtapaProgresso) => void;

export async function importarBase(file: File, onEtapa?: OnEtapa): Promise<ResumoImportacao> {
  // 1. Validando layout (busca do banco)
  onEtapa?.("validando");
  const layout = await carregarLayoutAtivo();

  // 2. Lendo arquivo
  onEtapa?.("lendo");
  const linhas = await parseExcelFile(file, layout);
  if (linhas.length === 0) {
    throw new Error("Nenhuma linha operacional válida encontrada no arquivo (verifique linha de dados e colunas obrigatórias).");
  }

  // 3. Enviando para o backend
  onEtapa?.("enviando");
  onEtapa?.("processando");
  const { data, error } = await supabase.functions.invoke("importar-base", {
    body: { nome_arquivo: file.name, linhas },
  });

  if (error) {
    // Tenta extrair erro real do corpo da resposta
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
