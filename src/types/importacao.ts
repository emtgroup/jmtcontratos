export interface ResumoImportacao {
  importacao_id: string;
  total_linhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
}

export interface LinhaParseada {
  contrato_vinculado: string;
  nota_fiscal: string;
  placa?: string;
  dados_originais: Record<string, unknown>;
}

export interface ImportacaoRequest {
  nome_arquivo: string;
  linhas: LinhaParseada[];
}
