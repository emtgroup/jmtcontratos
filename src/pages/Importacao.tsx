import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
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
import { CheckCircle, Upload, Loader2, AlertCircle, Unlock, Trash2, RefreshCcw } from "lucide-react";
import {
  importarBase,
  importarComplementar,
  liberarLockOrfao,
  limparDadosImportados,
  carregarEstadoBaseConsolidada,
  listarLayoutsComplementaresAtivos,
  type EstadoBaseConsolidada,
  type EscopoLimpezaImportacao,
  type EtapaProgresso,
  type LayoutComplementarResumo,
} from "@/services/importacaoBaseService";
import type { ResumoImportacao } from "@/types/importacao";
import { useToast } from "@/hooks/use-toast";

const LABEL_ETAPA: Record<EtapaProgresso, string> = {
  validando: "Validando layout configurado…",
  lendo: "Lendo arquivo Excel…",
  enviando: "Enviando arquivo para processamento…",
  processando_servidor: "Processando registros no servidor…",
  finalizando: "Finalizando importação…",
};

const LABEL_LIMPEZA: Record<EscopoLimpezaImportacao, string> = {
  base_conferencia: "Limpar Base + Conferência",
  complementares_conferencia: "Limpar Complementares + Conferência",
  tudo: "Limpar Tudo",
};

const ESTADO_INICIAL_CONSOLIDADO: EstadoBaseConsolidada = {
  total_registros_base: 0,
  total_vinculados: 0,
  total_aguardando: 0,
  total_divergentes: 0,
  total_ambiguos: 0,
};

type OrigemResumo = "base" | "complementar";

export default function Importacao() {
  // Resumo unificado da última ação (base ou complementar). Origem decide rótulos extras.
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [origemResumo, setOrigemResumo] = useState<OrigemResumo | null>(null);
  const [estadoConsolidado, setEstadoConsolidado] = useState<EstadoBaseConsolidada>(ESTADO_INICIAL_CONSOLIDADO);
  const [carregandoConsolidado, setCarregandoConsolidado] = useState(false);
  const [erroConsolidado, setErroConsolidado] = useState<string | null>(null);

  // === Base ===
  const [arquivoBase, setArquivoBase] = useState<File | null>(null);
  const [importandoBase, setImportandoBase] = useState(false);
  const [etapaBase, setEtapaBase] = useState<EtapaProgresso | null>(null);
  const [totalPreparadoBase, setTotalPreparadoBase] = useState<number | null>(null);
  const [erroBase, setErroBase] = useState<string | null>(null);
  const fileInputBase = useRef<HTMLInputElement>(null);

  // === Complementar ===
  const [layoutsComplementares, setLayoutsComplementares] = useState<LayoutComplementarResumo[]>([]);
  const [carregandoLayouts, setCarregandoLayouts] = useState(false);
  const [layoutComplementarId, setLayoutComplementarId] = useState<string>("");
  const [arquivoComplementar, setArquivoComplementar] = useState<File | null>(null);
  const [importandoComplementar, setImportandoComplementar] = useState(false);
  const [etapaComplementar, setEtapaComplementar] = useState<EtapaProgresso | null>(null);
  const [totalPreparadoComplementar, setTotalPreparadoComplementar] = useState<number | null>(null);
  const [erroComplementar, setErroComplementar] = useState<string | null>(null);
  const fileInputComplementar = useRef<HTMLInputElement>(null);

  // === Outros ===
  const [liberandoLock, setLiberandoLock] = useState(false);
  const [dialogLimpezaAberto, setDialogLimpezaAberto] = useState(false);
  const [escopoLimpeza, setEscopoLimpeza] = useState<EscopoLimpezaImportacao>("base_conferencia");
  const [limpando, setLimpando] = useState(false);
  const { toast } = useToast();

  const importandoQualquer = importandoBase || importandoComplementar;

  const carregarConsolidado = async () => {
    setCarregandoConsolidado(true);
    setErroConsolidado(null);
    try {
      const dados = await carregarEstadoBaseConsolidada();
      setEstadoConsolidado(dados);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroConsolidado(msg);
    } finally {
      setCarregandoConsolidado(false);
    }
  };

  const carregarLayoutsComplementares = async () => {
    setCarregandoLayouts(true);
    try {
      const lista = await listarLayoutsComplementaresAtivos();
      setLayoutsComplementares(lista);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Não foi possível carregar layouts complementares", description: msg, variant: "destructive" });
    } finally {
      setCarregandoLayouts(false);
    }
  };

  useEffect(() => {
    void carregarConsolidado();
    void carregarLayoutsComplementares();
  }, []);

  const handleImportBase = async () => {
    if (!arquivoBase) return;
    setImportandoBase(true);
    setErroBase(null);
    setResumo(null);
    setOrigemResumo(null);
    setEtapaBase(null);
    setTotalPreparadoBase(null);

    try {
      const result = await importarBase(
        arquivoBase,
        (e) => setEtapaBase(e),
        (total) => setTotalPreparadoBase(total),
      );
      setResumo(result);
      setOrigemResumo("base");
      const extra = result.primeiro_erro ? ` (1º erro: ${result.primeiro_erro})` : "";
      toast({
        title: "Importação base concluída",
        description:
          `${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.ignorados} ignorados, ` +
          `${result.vinculados} vinculados, ${result.aguardando} aguardando, ${result.divergentes} divergentes, ${result.ambiguos} ambíguos, ${result.erros} erros${extra}`,
      });
      await carregarConsolidado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroBase(msg);
      toast({ title: "Erro na importação base", description: msg, variant: "destructive" });
    } finally {
      setImportandoBase(false);
      setEtapaBase(null);
    }
  };

  const handleImportComplementar = async () => {
    if (!arquivoComplementar || !layoutComplementarId) return;
    setImportandoComplementar(true);
    setErroComplementar(null);
    setResumo(null);
    setOrigemResumo(null);
    setEtapaComplementar(null);
    setTotalPreparadoComplementar(null);

    try {
      const result = await importarComplementar(
        arquivoComplementar,
        layoutComplementarId,
        (e) => setEtapaComplementar(e),
        (total) => setTotalPreparadoComplementar(total),
      );
      setResumo(result);
      setOrigemResumo("complementar");
      const semBase = result.ignorados_sem_base ?? 0;
      toast({
        title: "Importação complementar concluída",
        description:
          `${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.ignorados} ignorados ` +
          `(${semBase} sem base na linha), ${result.vinculados} vinculados, ${result.ambiguos} ambíguos.`,
      });
      await carregarConsolidado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroComplementar(msg);
      toast({ title: "Erro na importação complementar", description: msg, variant: "destructive" });
    } finally {
      setImportandoComplementar(false);
      setEtapaComplementar(null);
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
      const resultado = await limparDadosImportados(escopoLimpeza);
      setResumo(null);
      setOrigemResumo(null);
      setErroBase(null);
      setErroComplementar(null);
      setArquivoBase(null);
      setArquivoComplementar(null);
      if (fileInputBase.current) fileInputBase.current.value = "";
      if (fileInputComplementar.current) fileInputComplementar.current.value = "";
      setDialogLimpezaAberto(false);

      toast({
        title: "Limpeza concluída",
        description:
          `${LABEL_LIMPEZA[resultado.escopo]} executada: ` +
          `${resultado.registros_base_removidos} base, ${resultado.registros_complementares_removidos} complementares, ` +
          `${resultado.conferencia_removida} conferência.`,
      });

      await carregarConsolidado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao limpar dados", description: msg, variant: "destructive" });
    } finally {
      setLimpando(false);
    }
  };

  const resumoExecucaoItems = resumo
    ? [
        { label: "Total lido", value: resumo.total_linhas },
        { label: "Inseridos", value: resumo.inseridos },
        { label: "Atualizados", value: resumo.atualizados },
        { label: "Ignorados", value: resumo.ignorados },
      ]
    : [];

  const resumoConsolidadoItems = [
    { label: "Total na Base", value: estadoConsolidado.total_registros_base },
    { label: "Vinculados", value: estadoConsolidado.total_vinculados },
    { label: "Aguardando", value: estadoConsolidado.total_aguardando },
    { label: "Divergentes", value: estadoConsolidado.total_divergentes },
    { label: "Ambíguos", value: estadoConsolidado.total_ambiguos },
  ];

  const semLayoutsComplementares = !carregandoLayouts && layoutsComplementares.length === 0;
  const layoutComplementarSelecionado = layoutsComplementares.find((l) => l.id === layoutComplementarId);

  return (
    <div>
      <PageHeader
        title="Importação de Dados"
        subtitle="Informe o Relatório GRL053 (Base) e os relatórios complementares."
      />

      <div className="flex justify-end mb-4">
        <Dialog open={dialogLimpezaAberto} onOpenChange={setDialogLimpezaAberto}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              disabled={importandoQualquer || liberandoLock || limpando}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar dados importados
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Limpar dados importados</DialogTitle>
              <DialogDescription>
                Escolha o escopo da limpeza. Esta ação é destrutiva e deve ser usada apenas quando houver intenção
                clara.
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
                  <span className="block text-xs text-muted-foreground">
                    Apaga registros da base operacional e toda a conferência materializada.
                  </span>
                </Label>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="complementares_conferencia" id="limpar-complementares" className="mt-1" />
                <Label htmlFor="limpar-complementares" className="space-y-1 cursor-pointer">
                  <span className="font-medium">Limpar Complementares + Conferência</span>
                  <span className="block text-xs text-muted-foreground">
                    Apaga registros complementares e a conferência para evitar status desatualizado.
                  </span>
                </Label>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="tudo" id="limpar-tudo" className="mt-1" />
                <Label htmlFor="limpar-tudo" className="space-y-1 cursor-pointer">
                  <span className="font-medium">Limpar Tudo</span>
                  <span className="block text-xs text-muted-foreground">
                    Apaga base, complementares e conferência. Histórico de importações é preservado para auditoria.
                  </span>
                </Label>
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogLimpezaAberto(false)} disabled={limpando}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleLimparDadosImportados}
                disabled={limpando || importandoQualquer || liberandoLock}
              >
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
              Etapa 1: carregue o relatório base oficial (GRL053). Layout é lido de /configuracoes. Importação
              incremental — nunca destrutiva.
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

            {importandoBase && etapaBase && (
              <div className="space-y-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{LABEL_ETAPA[etapaBase]}</span>
                </div>
                {totalPreparadoBase !== null && (
                  <p className="text-xs">
                    {etapaBase === "enviando"
                      ? `Enviando ${totalPreparadoBase.toLocaleString("pt-BR")} registros para processamento.`
                      : etapaBase === "finalizando"
                        ? `Finalizando importação de ${totalPreparadoBase.toLocaleString("pt-BR")} registros.`
                        : `Processando ${totalPreparadoBase.toLocaleString("pt-BR")} registros no servidor.`}
                  </p>
                )}
                <p className="text-xs">O processamento pode levar alguns segundos. Não feche esta tela.</p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleImportBase}
              disabled={!arquivoBase || importandoQualquer || limpando}
            >
              {importandoBase ? (
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
              disabled={liberandoLock || importandoQualquer || limpando}
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              {liberandoLock ? "Verificando lock..." : "Liberar lock travado (>5 min)"}
            </Button>
          </CardContent>
        </Card>

        {/* Complementar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relatório Complementar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Etapa 2: importação complementar. Só atualiza chaves que já existem na Base — nunca cria/altera registros base.
            </p>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Layout complementar
              </label>
              <Select
                value={layoutComplementarId}
                onValueChange={setLayoutComplementarId}
                disabled={carregandoLayouts || semLayoutsComplementares || importandoQualquer || limpando}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      carregandoLayouts
                        ? "Carregando layouts..."
                        : semLayoutsComplementares
                          ? "Nenhum layout cadastrado"
                          : "Selecione o layout"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {layoutsComplementares.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome_exibicao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {layoutComplementarSelecionado && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Layout selecionado: <span className="font-mono">{layoutComplementarSelecionado.id}</span>
                </p>
              )}
              {semLayoutsComplementares && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Cadastre um layout em{" "}
                  <Link to="/configuracoes" className="underline text-primary">
                    /configuracoes
                  </Link>{" "}
                  antes de importar.
                </p>
              )}
            </div>

            <input
              ref={fileInputComplementar}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setArquivoComplementar(e.target.files?.[0] || null)}
            />
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                semLayoutsComplementares
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-primary/50"
              }`}
              onClick={() => {
                if (!semLayoutsComplementares) fileInputComplementar.current?.click();
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {arquivoComplementar ? (
                <p className="text-sm font-medium">{arquivoComplementar.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formato: .xlsx, .xls, .csv</p>
                </>
              )}
            </div>

            {importandoComplementar && etapaComplementar && (
              <div className="space-y-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{LABEL_ETAPA[etapaComplementar]}</span>
                </div>
                {totalPreparadoComplementar !== null && (
                  <p className="text-xs">
                    {etapaComplementar === "enviando"
                      ? `Enviando ${totalPreparadoComplementar.toLocaleString("pt-BR")} registros para processamento.`
                      : etapaComplementar === "finalizando"
                        ? `Finalizando importação de ${totalPreparadoComplementar.toLocaleString("pt-BR")} registros.`
                        : `Processando ${totalPreparadoComplementar.toLocaleString("pt-BR")} registros no servidor.`}
                  </p>
                )}
                <p className="text-xs">O processamento pode levar alguns segundos. Não feche esta tela.</p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleImportComplementar}
              disabled={
                !arquivoComplementar ||
                !layoutComplementarId ||
                importandoQualquer ||
                limpando ||
                semLayoutsComplementares
              }
            >
              {importandoComplementar ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importação em andamento...
                </>
              ) : (
                "Importar Complementar"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Erros */}
      {erroBase && (
        <Card className="border-l-4 border-l-[hsl(var(--status-divergente))] mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-[hsl(var(--status-divergente))]">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Falha na importação base</p>
                <p className="text-xs font-mono whitespace-pre-wrap break-words">{erroBase}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {erroComplementar && (
        <Card className="border-l-4 border-l-[hsl(var(--status-divergente))] mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-[hsl(var(--status-divergente))]">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Falha na importação complementar</p>
                <p className="text-xs font-mono whitespace-pre-wrap break-words">{erroComplementar}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da importação atual (base ou complementar) */}
      {resumo && (
        <Card className="border-l-4 border-l-[hsl(var(--status-vinculado))] mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--status-vinculado))]" />
              Resultado da Importação Atual
              {origemResumo && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({origemResumo === "base" ? "Base" : "Complementar"})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Estes números representam apenas a última execução enviada agora.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {resumoExecucaoItems.map((item) => (
                <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <div className="text-center p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground uppercase">Vinculados</p>
                <p className="font-semibold">{resumo.vinculados}</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground uppercase">Aguardando</p>
                <p className="font-semibold">{resumo.aguardando}</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground uppercase">Divergentes</p>
                <p className="font-semibold">{resumo.divergentes}</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground uppercase">Ambíguos</p>
                <p className="font-semibold">{resumo.ambiguos}</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground uppercase">Erros</p>
                <p className="font-semibold">{resumo.erros}</p>
              </div>
            </div>
            {origemResumo === "complementar" && resumo.ignorados_sem_base !== undefined && (
              <div className="mt-4 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                <span className="font-semibold">Ignorados sem base na linha:</span>{" "}
                {resumo.ignorados_sem_base.toLocaleString("pt-BR")} (chaves do arquivo que não existem em
                registros_base — não são importadas).
              </div>
            )}
            {resumo.primeiro_erro && (
              <div className="mt-4 text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2 break-words">
                <span className="font-semibold">1º erro:</span> {resumo.primeiro_erro}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado consolidado */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Estado Atual do Sistema (Base Consolidada)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Estes indicadores vêm das tabelas consolidadas (`registros_base` + `conferencia`) e refletem o estado real atual.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={carregarConsolidado}
            disabled={carregandoConsolidado || importandoQualquer || limpando}
          >
            {carregandoConsolidado ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {erroConsolidado ? (
            <div className="text-xs text-[hsl(var(--status-divergente))] font-mono bg-[hsl(var(--status-divergente)/0.08)] rounded-md px-3 py-2">
              Falha ao carregar estado consolidado: {erroConsolidado}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {resumoConsolidadoItems.map((item) => (
                <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
