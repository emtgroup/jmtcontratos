import { useState, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, Upload, Loader2, AlertCircle, Unlock } from "lucide-react";
import { importarBase, liberarLockOrfao, type EtapaProgresso } from "@/services/importacaoBaseService";
import type { ResumoImportacao } from "@/types/importacao";
import { useToast } from "@/hooks/use-toast";

const LABEL_ETAPA: Record<EtapaProgresso, string> = {
  validando: "Validando layout configurado…",
  lendo: "Lendo arquivo Excel…",
  enviando: "Enviando arquivo para processamento…",
  // Texto explícito evita sensação de travamento: após envio, o trabalho continua no servidor.
  processando_servidor: "Processando registros no servidor…",
  finalizando: "Finalizando importação…",
};

export default function Importacao() {
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [layoutSelecionado, setLayoutSelecionado] = useState("");
  const [arquivoBase, setArquivoBase] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [etapa, setEtapa] = useState<EtapaProgresso | null>(null);
  const [totalPreparado, setTotalPreparado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [liberandoLock, setLiberandoLock] = useState(false);
  const fileInputBase = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImportBase = async () => {
    if (!arquivoBase) return;
    setImportando(true);
    setErro(null);
    setResumo(null);
    setEtapa(null);
    setTotalPreparado(null);

    try {
      const result = await importarBase(arquivoBase, (e) => setEtapa(e), (total) => setTotalPreparado(total));
      setResumo(result);
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
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally {
      setImportando(false);
      setEtapa(null);
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

  return (
    <div>
      <PageHeader title="Importação de Dados" subtitle="Importação real com persistência no Lovable Cloud" />

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
            {importando && etapa && (
              <div className="space-y-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{LABEL_ETAPA[etapa]}</span>
                </div>
                {/* Não exibimos percentual fake; mostramos apenas métricas reais já conhecidas no cliente. */}
                {totalPreparado !== null && (
                  <p className="text-xs">
                    {etapa === "enviando"
                      ? `Enviando ${totalPreparado.toLocaleString("pt-BR")} registros para processamento.`
                      : etapa === "finalizando"
                        ? `Finalizando importação de ${totalPreparado.toLocaleString("pt-BR")} registros.`
                      : `Processando ${totalPreparado.toLocaleString("pt-BR")} registros no servidor.`}
                  </p>
                )}
                {/* Mensagem curta de espera para reduzir dúvida operacional durante processamento longo. */}
                <p className="text-xs">O processamento pode levar alguns segundos. Não feche esta tela.</p>
              </div>
            )}

            <Button className="w-full" onClick={handleImportBase} disabled={!arquivoBase || importando}>
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
              disabled={liberandoLock || importando}
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
