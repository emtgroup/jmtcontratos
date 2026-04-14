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

// Mock revisado para representar padrões reais de contrato/nota sem implementar normalização definitiva.
export const conferenciaRecords: ConferenciaRecord[] = [
  { id: "1", contrato: "MTP 16876", nota: "25031", placa: "QAZ2B45", pesoBase: 32500, pesoComplementar: 32480, valor: 48750.0, status: "vinculado", origem: "GRL053", chaveDeterministica: "MTP16876|25031" },
  { id: "2", contrato: "AFX 33610-33316", nota: "12345", placa: "RTE4C12", pesoBase: 28900, pesoComplementar: 28900, valor: 43350.0, status: "vinculado", origem: "Inpasa", chaveDeterministica: "AFX3361033316|12345" },
  { id: "3", contrato: "33044", nota: "000456", placa: "KLM9D88", pesoBase: 31200, pesoComplementar: null, valor: 46800.0, status: "aguardando", origem: "GRL053", chaveDeterministica: "33044|000456" },
  { id: "4", contrato: "17290-1", nota: "987654", placa: "HJK1A09", pesoBase: 29800, pesoComplementar: 30500, valor: 44700.0, status: "divergente", origem: "Bunge", chaveDeterministica: "172901|987654" },
  { id: "5", contrato: "BXA 55421", nota: "451299", placa: "PLM5F77", pesoBase: 33100, pesoComplementar: 33050, valor: 49650.0, status: "vinculado", origem: "FS", chaveDeterministica: "BXA55421|451299" },
  { id: "6", contrato: "78102", nota: "804512", placa: "NVB3G26", pesoBase: 27600, pesoComplementar: 27650, valor: 41400.0, status: "ambiguo", origem: "Inpasa", chaveDeterministica: "78102|804512" },
];

export const layoutBaseColumns: LayoutColumn[] = [
  // Labels de campos alinhados ao vocabulário oficial do projeto nesta fase de interface mockada.
  { id: "1", colunaExcel: "A", apelido: "Contrato Vinculado", tipo: "texto", analise: true },
  { id: "2", colunaExcel: "B", apelido: "Nota Fiscal", tipo: "texto", analise: true },
  { id: "3", colunaExcel: "C", apelido: "Placa", tipo: "texto", analise: false },
  { id: "4", colunaExcel: "D", apelido: "Peso Fiscal", tipo: "numero", analise: true },
  { id: "5", colunaExcel: "E", apelido: "Peso Líquido", tipo: "numero", analise: true },
  { id: "6", colunaExcel: "F", apelido: "Clifor", tipo: "texto", analise: false },
  { id: "7", colunaExcel: "G", apelido: "Data", tipo: "data", analise: false },
];

export const layoutsComplementares: LayoutComplementar[] = [
  { id: "1", nome: "Inpasa - Recebimento", colunasMapeadas: 7 },
  { id: "2", nome: "FS - Controle de Carga", colunasMapeadas: 6 },
];

export const importResumoMock = {
  // Resumo continua 100% mock, apenas revisado para refletir operação visual mais realista.
  totalLido: 186,
  inseridos: 141,
  atualizados: 29,
  ignorados: 16,
  vinculados: 112,
  aguardando: 38,
  divergentes: 22,
  ambiguos: 14,
};

export const chartData = [
  { name: "Vinculados", value: 3, fill: "hsl(142, 71%, 45%)" },
  { name: "Aguardando", value: 1, fill: "hsl(48, 96%, 53%)" },
  { name: "Divergentes", value: 1, fill: "hsl(0, 84%, 60%)" },
  { name: "Ambíguos", value: 1, fill: "hsl(25, 95%, 53%)" },
];
