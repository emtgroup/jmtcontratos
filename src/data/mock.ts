export type StatusType = "vinculado" | "aguardando" | "divergente" | "ambiguo";

export interface ConferenciaRecord {
  id: string;
  contrato: string;
  nota: string;
  placa: string;
  pesoBase: number;
  pesoComplementar: number | null;
  valor: number;
  status: StatusType;
  origem: string;
  chaveDeterministica: string;
}

export interface LayoutColumn {
  id: string;
  colunaExcel: string;
  apelido: string;
  tipo: string;
  analise: boolean;
}

export interface LayoutComplementar {
  id: string;
  nome: string;
  colunasMapeadas: number;
}

export const statusLabels: Record<StatusType, string> = {
  vinculado: "Vinculado",
  aguardando: "Aguardando",
  divergente: "Divergente",
  ambiguo: "Ambíguo",
};

export const dashboardStats = {
  total: 6,
  vinculados: 3,
  aguardando: 1,
  divergentes: 1,
  ambiguos: 1,
};

export const conferenciaRecords: ConferenciaRecord[] = [
  { id: "1", contrato: "CTR-2024-001", nota: "NF-10234", placa: "ABC-1234", pesoBase: 32500, pesoComplementar: 32480, valor: 48750.0, status: "vinculado", origem: "GRL053", chaveDeterministica: "CTR-2024-001|NF-10234" },
  { id: "2", contrato: "CTR-2024-002", nota: "NF-10235", placa: "DEF-5678", pesoBase: 28900, pesoComplementar: 28900, valor: 43350.0, status: "vinculado", origem: "GRL053", chaveDeterministica: "CTR-2024-002|NF-10235" },
  { id: "3", contrato: "CTR-2024-003", nota: "NF-10236", placa: "GHI-9012", pesoBase: 31200, pesoComplementar: null, valor: 46800.0, status: "aguardando", origem: "GRL053", chaveDeterministica: "CTR-2024-003|NF-10236" },
  { id: "4", contrato: "CTR-2024-004", nota: "NF-10237", placa: "JKL-3456", pesoBase: 29800, pesoComplementar: 30500, valor: 44700.0, status: "divergente", origem: "GRL053", chaveDeterministica: "CTR-2024-004|NF-10237" },
  { id: "5", contrato: "CTR-2024-005", nota: "NF-10238", placa: "MNO-7890", pesoBase: 33100, pesoComplementar: 33050, valor: 49650.0, status: "vinculado", origem: "GRL053", chaveDeterministica: "CTR-2024-005|NF-10238" },
  { id: "6", contrato: "CTR-2024-006", nota: "NF-10239", placa: "PQR-1122", pesoBase: 27600, pesoComplementar: 27650, valor: 41400.0, status: "ambiguo", origem: "Complementar", chaveDeterministica: "CTR-2024-006|NF-10239" },
];

export const layoutBaseColumns: LayoutColumn[] = [
  { id: "1", colunaExcel: "A", apelido: "Contrato", tipo: "texto", analise: true },
  { id: "2", colunaExcel: "B", apelido: "Nota Fiscal", tipo: "texto", analise: true },
  { id: "3", colunaExcel: "C", apelido: "Placa", tipo: "texto", analise: false },
  { id: "4", colunaExcel: "D", apelido: "Peso Líquido", tipo: "numero", analise: true },
  { id: "5", colunaExcel: "E", apelido: "Valor", tipo: "moeda", analise: true },
  { id: "6", colunaExcel: "F", apelido: "Data Emissão", tipo: "data", analise: false },
];

export const layoutsComplementares: LayoutComplementar[] = [];

export const importResumoMock = {
  totalLido: 150,
  inseridos: 120,
  atualizados: 18,
  ignorados: 12,
  vinculados: 85,
  aguardando: 20,
  divergentes: 10,
  ambiguos: 5,
};

export const chartData = [
  { name: "Vinculados", value: 3, fill: "hsl(142, 71%, 45%)" },
  { name: "Aguardando", value: 1, fill: "hsl(48, 96%, 53%)" },
  { name: "Divergentes", value: 1, fill: "hsl(0, 84%, 60%)" },
  { name: "Ambíguos", value: 1, fill: "hsl(25, 95%, 53%)" },
];
