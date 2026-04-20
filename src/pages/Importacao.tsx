import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, Upload, Loader2, AlertCircle, Unlock, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  importarBase,
  buscarProgressoImportacaoBaseAtiva,
  liberarLockOrfao,
  limparDadosImportados,
  type EscopoLimpezaImportacao,
  type EtapaProgresso,
  type ProgressoImportacaoBase,
} from "@/services/importacaoBaseService";
import type { ResumoImportacao } from "@/types/importacao";
import { useToast } from "@/hooks/use-toast";

const LABEL_ETAPA: Record<EtapaProgresso, string> = {
  validando: "Validando layout configurado…",
  lendo: "Lendo arquivo Excel…",
  enviando: "Aplicando layout e preparando envio…",
  // Texto explícito evita sensação de travamento: após envio, o trabalho continua no servidor.
  processando_servidor: "Persistindo registros e atualizando conferência no servidor…",
  finalizando: "Finalizando importação…",
};

const ORDEM_ETAPAS: EtapaProgresso[] = ["validando", "lendo", "enviando", "processando_servidor", "finalizando"];

const LABEL_ETAPA_BACKEND: Record<string, string> = {
  iniciando: "Iniciando importação no servidor…",
  validando_lock: "Validando concorrência de importação…",
  normalizando_dados: "Normalizando dados da planilha…",
  classificando_registros: "Classificando registros para inserir/atualizar/ignorar…",
  persistindo_registros: "Persistindo registros no banco…",
  atualizando_conferencia: "Atualizando conferência materializada…",
  consolidando_resultado: "Consolidando resultado da importação…",
  finalizando_importacao: "Finalizando importação…",
  erro: "Importação finalizada com erro.",
};

const LABEL_LIMPEZA: Record<EscopoLimpezaImportacao, string> = {
  base_conferencia: "Limpar Base + Conferência",
  complementares_conferencia: "Limpar Complementares + Conferência",
  tudo: "Limpar Tudo",
};

export default function Importacao() {
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [layoutSelecionado, setLayoutSelecionado] = useState("");
  const [arquivoBase, setArquivoBase] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [etapa, setEtapa] = useState<EtapaProgresso | null>(null);
  const [totalPreparado, setTotalPreparado] = useState<number | null>(null);
  const [progressoReal, setProgressoReal] = useState<ProgressoImportacaoBase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [liberandoLock, setLiberandoLock] = useState(false);
  const [dialogLimpezaAberto, setDialogLimpezaAberto] = useState(false);
  const [escopoLimpeza, setEscopoLimpeza] = useState<EscopoLimpezaImportacao>("base_conferencia");
  const [limpando, setLimpando] = useState(false);
  const fileInputBase = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<number | null>(null);
  const { toast } = useToast();

  const pararPolling = () => {
    // Encerramos o polling explicitamente ao concluir/falhar para evitar loop eterno.
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const atualizarProgressoReal = async () => {
    try {
      const progresso = await buscarProgressoImportacaoBaseAtiva();
      if (!progresso) return;
      setProgressoReal(progresso);

      if (progresso.status_processamento !== "processando") {
        pararPolling();
      }
    } catch {
      // Polling não deve derrubar a tela de importação; próxima rodada tentará novamente.
    }
  };

  useEffect(() => () => pararPolling(), []);

  const handleImportBase = async () => {
    if (!arquivoBase) return;
    setImportando(true);
    setErro(null);
    setResumo(null);
    setEtapa(null);
    setTotalPreparado(null);
    setProgressoReal(null);

    try {
      // Polling leve só durante a importação ativa para ler telemetria real (importacao_id via lock).
      pararPolling();
      pollingRef.current = window.setInterval(() => {
        void atualizarProgressoReal();
      }, 1500);
      void atualizarProgressoReal();

      const result = await importarBase(arquivoBase, (e) => setEtapa(e), (total) => setTotalPreparado(total));
      setResumo(result);
      setProgressoReal((prev) =>
        prev
          ? {
              ...prev,
              status_processamento: "finalizado",
              total_linhas: result.total_linhas,
              linhas_processadas: result.total_linhas,
              inseridos: result.inseridos,
              atualizados: result.atualizados,
              ignorados: result.ignorados,
              erros: result.erros,
            }
          : prev,
      );
      const extra = result.primeiro_erro ? ` (1º erro: ${result.primeiro_erro})` : "";
      toast({
        title: "Importação concluída",
        description:
          `${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.ignorados} ignorados, ` +
          `${result.vinculados} vinculados, ${result.aguardando} aguardando, ${result.divergentes} divergentes, ${result.ambiguos} ambíguos, ${result.erros} erros${extra}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      setProgressoReal((prev) => (prev ? { ...prev, status_processamento: "erro" } : prev));
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally {
      setImportando(false);
      setEtapa(null);
      pararPolling();
    }
  };

  const handleLiberarLock = async () => {
    setLiberandoLock(true);
    try {
      const ok = await liberarLockOrfao();
      toast({
        title: ok ? "Lock liberado" : "Sem lock ativo",
        description: ok ? "Você já pode iniciar uma nova importação." : "Nenhum lock estava preso.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Não foi possível liberar o lock", description: msg, variant: "destructive" });
    } finally {
      setLiberandoLock(false);
    }
  };

  const handleLimparDadosImportados = async () => {
    setLimpando(true);
    try {
      // Limpeza de dados é sempre explícita e só acontece após confirmação no dialog.
      const resultado = await limparDadosImportados(escopoLimpeza);
      setResumo(null);
      setErro(null);
      setArquivoBase(null);
      if (fileInputBase.current) fileInputBase.current.value = "";
      setDialogLimpezaAberto(false);

      toast({
        title: "Limpeza concluída",
        description:
          `${LABEL_LIMPEZA[resultado.escopo]} executada: ` +
          `${resultado.registros_base_removidos} base, ${resultado.registros_complementares_removidos} complementares, ` +
          `${resultado.conferencia_removida} conferência.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao limpar dados", description: msg, variant: "destructive" });
    } finally {
      setLimpando(false);
    }
  };

  const resumoItems = resumo
    ? [
        // Resumo segue os indicadores operacionais exigidos no PRD de importação.
        { label: "Total lido", value: resumo.total_linhas },
        { label: "Inseridos", value: resumo.inseridos },
        { label: "Atualizados", value: resumo.atualizados },
        { label: "Ignorados", value: resumo.ignorados },
        { label: "Vinculados", value: resumo.vinculados },
        { label: "Aguardando", value: resumo.aguardando },
        { label: "Divergentes", value: resumo.divergentes },
        { label: "Ambíguos", value: resumo.ambiguos },
        { label: "Erros", value: resumo.erros },
      ]
    : [];

  const indiceEtapaAtual = etapa ? ORDEM_ETAPAS.indexOf(etapa) : -1;
  // Percentual sempre real: calculado apenas com telemetria do backend (linhas_processadas / total_linhas).
  const percentualReal =
    progressoReal && progressoReal.total_linhas > 0
      ? Math.min(100, (progressoReal.linhas_processadas / progressoReal.total_linhas) * 100)
      : null;
  const etapaAtivaTexto = progressoReal ? LABEL_ETAPA_BACKEND[progressoReal.etapa_atual] ?? progressoReal.etapa_atual : etapa ? LABEL_ETAPA[etapa] : null;
  const mostrarPainelProgresso = importando && (etapa || progressoReal);

  return (
    <div>
      <PageHeader title="Importação de Dados" subtitle="Importação real com persistência no Lovable Cloud" />

      <div className="flex justify-end mb-4">
        <Dialog open={dialogLimpezaAberto} onOpenChange={setDialogLimpezaAberto}>
          <DialogTrigger asChild>
            {/* Ação destrutiva fica secundária para não competir com o fluxo principal de importação. */}
            <Button variant="outline" size="sm" className="text-muted-foreground" disabled={importando || liberandoLock || limpando}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar dados importados
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Limpar dados importados</DialogTitle>
              <DialogDescription>
                Escolha o escopo da limpeza. Esta ação é destrutiva e deve ser usada apenas quando houver intenção clara.
              </DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={escopoLimpeza}
              onValueChange={(value) => setEscopoLimpeza(value as EscopoLimpezaImportacao)}
              className="space-y-3"
            >
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="base_conferencia" id="limpar-base" className="mt-1" />
                <Label htmlFor="limpar-base" className="space-y-1 cursor-pointer">
                  <span className="font-medium">Limpar Base + Conferência</span>
                  <span className="block text-xs text-muted-foreground">Apaga registros da base operacional e toda a conferência materializada.</span>
                </Label>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="complementares_conferencia" id="limpar-complementares" className="mt-1" />
                <Label htmlFor="limpar-complementares" className="space-y-1 cursor-pointer">
                  <span className="font-medium">Limpar Complementares + Conferência</span>
                  <span className="block text-xs text-muted-foreground">Apaga registros complementares e a conferência para evitar status desatualizado.</span>
                </Label>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="tudo" id="limpar-tudo" className="mt-1" />
                <Label htmlFor="limpar-tudo" className="space-y-1 cursor-pointer">
                  <span className="font-medium">Limpar Tudo</span>
                  <span className="block text-xs text-muted-foreground">Apaga base, complementares e conferência. Histórico de importações é preservado para auditoria.</span>
                </Label>
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogLimpezaAberto(false)} disabled={limpando}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleLimparDadosImportados} disabled={limpando || importando || liberandoLock}>
                {limpando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  "Confirmar limpeza"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Base */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base GRL053</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Etapa 1: carregue o relatório base oficial (GRL053). Layout é lido de /configuracoes. Importação incremental — nunca destrutiva.
            </p>
            <input
              ref={fileInputBase}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setArquivoBase(e.target.files?.[0] || null)}
            />
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputBase.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {arquivoBase ? (
                <p className="text-sm font-medium">{arquivoBase.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formato: .xlsx, .xls, .csv</p>
                </>
              )}
            </div>

            {/* Progresso por etapa */}
            {mostrarPainelProgresso && (
              <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{etapaAtivaTexto}</span>
                </div>
                {/* Regra de honestidade operacional: só exibimos barra percentual quando vier valor real do backend. */}
                {percentualReal !== null ? (
                  <div className="space-y-1">
                    <Progress value={percentualReal} />
                    <p className="text-xs text-muted-foreground">{percentualReal.toFixed(0)}% concluído (progresso real do servidor).</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      {/* Barra indeterminada para reforçar atividade contínua sem percentual fictício. */}
                      <div className="absolute inset-y-0 w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Progresso percentual em tempo real ainda não disponível no backend.</p>
                  </div>
                )}

                {/* Lista de etapas deixa explícito "onde está" sem inventar tempo restante ou percentuais. */}
                {!progressoReal && (
                  <div className="space-y-1">
                    {ORDEM_ETAPAS.map((etapaItem, idx) => {
                      const status = idx < indiceEtapaAtual ? "concluida" : idx === indiceEtapaAtual ? "ativa" : "pendente";
                      return (
                        <p
                          key={etapaItem}
                          className={`text-xs ${
                            status === "ativa"
                              ? "text-foreground font-medium"
                              : status === "concluida"
                                ? "text-muted-foreground"
                                : "text-muted-foreground/80"
                          }`}
                        >
                          {status === "concluida" ? "✓ " : status === "ativa" ? "→ " : "• "}
                          {LABEL_ETAPA[etapaItem]}
                        </p>
                      );
                    })}
                  </div>
                )}

                {/* Não exibimos percentual fake; mostramos apenas métricas reais já conhecidas no cliente. */}
                {progressoReal ? (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>Processados: {progressoReal.linhas_processadas.toLocaleString("pt-BR")} / {progressoReal.total_linhas.toLocaleString("pt-BR")}</p>
                    <p>Inseridos: {progressoReal.inseridos.toLocaleString("pt-BR")}</p>
                    <p>Atualizados: {progressoReal.atualizados.toLocaleString("pt-BR")}</p>
                    <p>Ignorados: {progressoReal.ignorados.toLocaleString("pt-BR")}</p>
                    <p>Erros: {progressoReal.erros.toLocaleString("pt-BR")}</p>
                  </div>
                ) : totalPreparado !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {etapa === "enviando"
                      ? `Enviando ${totalPreparado.toLocaleString("pt-BR")} registros para processamento.`
                      : etapa === "finalizando"
                        ? `Finalizando importação de ${totalPreparado.toLocaleString("pt-BR")} registros.`
                        : `Processando ${totalPreparado.toLocaleString("pt-BR")} registros no servidor.`}
                  </p>
                ) : null}

                {progressoReal?.status_processamento === "erro" && (
                  <p className="text-xs text-[hsl(var(--status-divergente))]">
                    A importação registrou erro no servidor. Verifique a mensagem detalhada abaixo.
                  </p>
                )}
                {/* Mensagem de segurança operacional para arquivos grandes e etapas longas. */}
                <p className="text-xs text-muted-foreground">
                  A importação continua em execução no servidor. Não feche esta tela até a conclusão.
                </p>
                <p className="text-xs text-muted-foreground">Arquivos maiores podem levar mais tempo.</p>
              </div>
            )}

            <Button className="w-full" onClick={handleImportBase} disabled={!arquivoBase || importando || limpando}>
              {importando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importação em andamento...
                </>
              ) : (
                "Importar Base"
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={handleLiberarLock}
              disabled={liberandoLock || importando || limpando}
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              {liberandoLock ? "Verificando lock..." : "Liberar lock travado (>5 min)"}
            </Button>
          </CardContent>
        </Card>

        {/* Complementar — desabilitado nesta etapa */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base">Relatório Complementar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Etapa 2 (em breve): importação complementar será habilitada na próxima entrega.
            </p>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Layout complementar
              </label>
              <Select value={layoutSelecionado} onValueChange={setLayoutSelecionado} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Disponível na próxima etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fs">FS - Controle de Carga</SelectItem>
                  <SelectItem value="bunge">Bunge - Recebimento</SelectItem>
                  <SelectItem value="inpasa">Inpasa - Recebimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" variant="secondary" disabled>
              Importar Complementar (em breve)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Erro bruto */}
      {erro && (
        <Card className="border-l-4 border-l-[hsl(var(--status-divergente))] mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-[hsl(var(--status-divergente))]">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Falha na importação</p>
                <p className="text-xs font-mono whitespace-pre-wrap break-words">{erro}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {resumo && (
        <Card className="border-l-4 border-l-[hsl(var(--status-vinculado))]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--status-vinculado))]" />
              Resumo da Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {resumoItems.map((item) => (
                <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            {resumo.primeiro_erro && (
              <div className="mt-4 text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2 break-words">
                <span className="font-semibold">1º erro:</span> {resumo.primeiro_erro}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
