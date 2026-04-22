export interface ResumoImportacao {
  importacao_id: string;
  total_linhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  vinculados: number;
  aguardando: number;
  divergentes: number;
  ambiguos: number;
  erros: number;
  primeiro_erro?: string | null;
  /** Apenas no fluxo complementar: linhas cuja chave não existe em registros_base. */
  ignorados_sem_base?: number;
}

export interface LinhaParseada {
  contrato_vinculado: string;
  nota_fiscal: string;
  placa?: string;
  /** Data operacional da nota quando mapeada no layout (campo informativo). */
  data?: string;
  dados_originais: Record<string, unknown>;
}

export interface ImportacaoRequest {
  nome_arquivo: string;
  linhas: LinhaParseada[];
}

/**
 * Telemetria de progresso de uma importação base em andamento.
 * Usado pelo polling do frontend (buscarProgressoImportacaoBaseAtiva).
 */
export interface ProgressoImportacaoBase {
  importacao_id: string;
  status_processamento: "processando" | "finalizado" | "erro";
  etapa_atual: string;
  total_linhas: number;
  linhas_processadas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  updated_at: string;
}
