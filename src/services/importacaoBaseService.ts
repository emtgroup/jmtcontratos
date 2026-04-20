import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaParseada, ResumoImportacao } from "@/types/importacao";

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
        `Coluna "${col.nomeExcel}" (${col.tipoNormalizado}) não encontrada no cabeçalho da linha ${layout.linhaCabecalho}. Cabeçalhos disponíveis: [${disponiveis}]`
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

  const headerRow = (rawData[layout.linhaCabecalho - 1] || []) as unknown[];
  const resolved = resolverIndices(layout, headerRow);

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
