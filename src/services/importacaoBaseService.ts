import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaParseada, ResumoImportacao } from "@/types/importacao";

// Layout base mock — maps column type to Excel column letter
// In production this will come from layouts_base_colunas table
const LAYOUT_BASE_DEFAULT: Record<string, string> = {
  contrato_vinculado: "A",
  nota_fiscal: "B",
  placa: "C",
  peso_fiscal: "D",
  peso_liquido: "E",
  data_nota: "F",
  hora: "G",
  produto: "H",
  observacao_nf: "I",
  chave_acesso: "J",
  clifor: "K",
};

function getColumnIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

export async function parseExcelFile(file: File): Promise<LinhaParseada[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get all rows as array of arrays (raw)
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rawData.length < 2) {
    throw new Error("Arquivo vazio ou sem dados operacionais (mínimo: 1 cabeçalho + 1 linha)");
  }

  const headerRow = rawData[0] as string[];
  const dataRows = rawData.slice(1);

  const contratoIdx = getColumnIndex(LAYOUT_BASE_DEFAULT.contrato_vinculado);
  const notaIdx = getColumnIndex(LAYOUT_BASE_DEFAULT.nota_fiscal);
  const placaIdx = getColumnIndex(LAYOUT_BASE_DEFAULT.placa);

  const linhas: LinhaParseada[] = [];

  for (const row of dataRows) {
    const contrato = String(row[contratoIdx] ?? "").trim();
    const nota = String(row[notaIdx] ?? "").trim();

    if (!contrato || !nota) continue; // Skip invalid rows

    const dados_originais: Record<string, unknown> = {};
    headerRow.forEach((header, idx) => {
      if (header && row[idx] !== undefined && row[idx] !== "") {
        dados_originais[String(header).trim()] = row[idx];
      }
    });

    linhas.push({
      contrato_vinculado: contrato,
      nota_fiscal: nota,
      placa: String(row[placaIdx] ?? "").trim() || undefined,
      dados_originais,
    });
  }

  return linhas;
}

export async function importarBase(file: File): Promise<ResumoImportacao> {
  const linhas = await parseExcelFile(file);

  if (linhas.length === 0) {
    throw new Error("Nenhuma linha operacional válida encontrada no arquivo");
  }

  const { data, error } = await supabase.functions.invoke("importar-base", {
    body: {
      nome_arquivo: file.name,
      linhas,
    },
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar a função de importação");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as ResumoImportacao;
}
