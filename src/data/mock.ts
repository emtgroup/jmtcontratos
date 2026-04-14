export type StatusType = "vinculado" | "aguardando" | "divergente" | "ambiguo";

export interface ConferenciaRecord {
  id: string;
  contrato: string;
  nota: string;
  dataNF: string;
  horaNF?: string;
  produto: string;
  placa: string;
  pesoBase: number;
  pesoComplementar: number | null;
  status: StatusType;
  // Motivo textual do status exibido na tabela de conferência (apenas mock visual).
  motivo: string;
  chaveDeterministica: string;
  chaveAcesso: string;
  clifor: string;
  observacaoNF: string;
  comparacaoBase: string;
  comparacaoComplementar: string;
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
  { id: "1", contrato: "MTP 16876", nota: "25031", dataNF: "14/06/2025", horaNF: "16:02", produto: "Milho", placa: "QAZ2B45", pesoBase: 32500, pesoComplementar: 32480, status: "vinculado", motivo: "—", chaveDeterministica: "16876|25031", chaveAcesso: "51250646203786000145550010000257051000257070", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5984, contrato de recebimento Nº1466.", comparacaoBase: "16876", comparacaoComplementar: "16876" },
  // Ajuste visual de mock para ensinar a regra esperada de chave sem aplicar motor real de normalização.
  { id: "2", contrato: "AFX 33610-33316", nota: "12345", dataNF: "14/06/2025", horaNF: "16:07", produto: "Milho", placa: "RTE4C12", pesoBase: 28900, pesoComplementar: 28900, status: "vinculado", motivo: "—", chaveDeterministica: "33610|12345", chaveAcesso: "51250646203786000145550010000257061000257085", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5986, contrato de recebimento Nº1466.", comparacaoBase: "33610", comparacaoComplementar: "33610" },
  { id: "3", contrato: "33044", nota: "000456", dataNF: "14/06/2025", horaNF: "16:31", produto: "Milho", placa: "KLM9D88", pesoBase: 31200, pesoComplementar: null, status: "aguardando", motivo: "Sem relatório complementar", chaveDeterministica: "33044|000456", chaveAcesso: "51250646203786000145550010000257071000257090", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5988, contrato de recebimento Nº1466.", comparacaoBase: "33044", comparacaoComplementar: "—" },
  // Ajuste visual de mock para evitar que o sufixo após hífen pareça participar da chave final.
  { id: "4", contrato: "17290-1", nota: "987654", dataNF: "14/06/2025", horaNF: "16:35", produto: "Milho", placa: "HJK1A09", pesoBase: 29800, pesoComplementar: 30500, status: "divergente", motivo: "Contrato não confere", chaveDeterministica: "17290|987654", chaveAcesso: "51250646203786000145550010000257081000257101", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5990, contrato de recebimento Nº1466.", comparacaoBase: "17290", comparacaoComplementar: "17290-1" },
  { id: "5", contrato: "BXA 55421", nota: "451299", dataNF: "14/06/2025", horaNF: "16:37", produto: "Milho", placa: "PLM5F77", pesoBase: 33100, pesoComplementar: 33050, status: "vinculado", motivo: "—", chaveDeterministica: "55421|451299", chaveAcesso: "51250646203786000145550010000257091000257117", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5992, contrato de recebimento Nº1466.", comparacaoBase: "55421", comparacaoComplementar: "55421" },
  { id: "6", contrato: "78102", nota: "804512", dataNF: "14/06/2025", horaNF: "16:38", produto: "Milho", placa: "NVB3G26", pesoBase: 27600, pesoComplementar: 27650, status: "ambiguo", motivo: "Mais de um registro encontrado", chaveDeterministica: "78102|804512", chaveAcesso: "51250646203786000145550010000257101000257126", clifor: "LUIZ CARLOS DALLA LIBERA", observacaoNF: "Referente a NF 5994, contrato de recebimento Nº1466.", comparacaoBase: "78102", comparacaoComplementar: "78102" },
];

export const layoutBaseColumns: LayoutColumn[] = [
  // Tipos de coluna ajustados para refletir o conceito de negócio usado pelo sistema.
  { id: "1", colunaExcel: "A", apelido: "Contrato Vinculado", tipo: "Contrato vinculado", analise: true },
  { id: "2", colunaExcel: "B", apelido: "Nota Fiscal", tipo: "Nota fiscal", analise: true },
  { id: "3", colunaExcel: "C", apelido: "Placa", tipo: "Placa", analise: false },
  { id: "4", colunaExcel: "D", apelido: "Peso Fiscal", tipo: "Peso fiscal", analise: true },
  { id: "5", colunaExcel: "E", apelido: "Peso Líquido", tipo: "Peso líquido", analise: true },
  { id: "6", colunaExcel: "F", apelido: "Clifor", tipo: "Clifor", analise: false },
  { id: "7", colunaExcel: "G", apelido: "Data", tipo: "Data", analise: false },
];

export const layoutsComplementares: LayoutComplementar[] = [
  { id: "1", nome: "Inpasa - Recebimento", colunasMapeadas: 7 },
  { id: "2", nome: "FS - Controle de Carga", colunasMapeadas: 6 },
  { id: "3", nome: "Bunge - Recebimento Rodoviário", colunasMapeadas: 6 },
];

export const importResumoMock = {
  // Resumo continua 100% mock, apenas revisado para refletir operação visual mais realista.
  totalBaseLida: 126,
  totalComplementarLido: 60,
  combinados: 141,
  atualizados: 29,
  pendentesLayout: 16,
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
