import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { UploadArea } from "@/components/UploadArea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { importResumoMock } from "@/data/mock";
import { CheckCircle } from "lucide-react";

export default function Importacao() {
  const [showResumo, setShowResumo] = useState(false);
  const [layoutSelecionado, setLayoutSelecionado] = useState("");

  const handleImport = () => setShowResumo(true);

  // Separação explícita entre resultado da importação e reflexo na conferência para evitar ambiguidade conceitual.
  const resumoImportacaoItems = [
    { label: "Linhas lidas na Base (GRL053)", value: importResumoMock.totalBaseLida },
    { label: "Linhas lidas no Complementar", value: importResumoMock.totalComplementarLido },
    { label: "Registros processados", value: importResumoMock.combinados },
    { label: "Registros atualizados", value: importResumoMock.atualizados },
  ];

  // Status abaixo representam o estado exibido na conferência após a importação (não são etapas da carga em si).
  const resumoConferenciaItems = [
    { label: "Vinculados", value: importResumoMock.vinculados },
    { label: "Aguardando", value: importResumoMock.aguardando },
    { label: "Contrato Divergente", value: importResumoMock.divergentes },
    { label: "Ambíguos", value: importResumoMock.ambiguos },
  ];

  return (
    <div>
      <PageHeader title="Importação de Dados" subtitle="Fluxo operacional mockado para Base GRL053 e relatórios complementares" />

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Base */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base GRL053</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Etapa 1: carregue o relatório base oficial (GRL053). Este envio permanece 100% mock.
            </p>
            <UploadArea title="Arquivo da Base Principal" subtitle="Formato: .xlsx, .csv" />
            <Button className="w-full" onClick={handleImport}>Importar Base</Button>
          </CardContent>
        </Card>

        {/* Complementar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relatório Complementar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Etapa 2: selecione o layout complementar e depois anexe o relatório externo correspondente (mock).
            </p>
            <div>
              {/* Texto de apoio ajustado para deixar claro o contexto de mapeamento complementar. */}
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Layout complementar</label>
              <Select value={layoutSelecionado} onValueChange={setLayoutSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o layout de origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fs">FS - Controle de Carga</SelectItem>
                  <SelectItem value="bunge">Bunge - Recebimento</SelectItem>
                  <SelectItem value="inpasa">Inpasa - Recebimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <UploadArea
              title="Arquivo Complementar"
              subtitle={layoutSelecionado ? "Formato: .xlsx, .csv" : "Selecione um layout para habilitar este envio mockado"}
            />
            {/* Dependência visual entre layout e envio complementar; sem validação real de importação nesta fase. */}
            <Button className="w-full" variant="secondary" onClick={handleImport} disabled={!layoutSelecionado}>
              Importar Complementar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Resumo */}
      {showResumo && (
        <Card className="border-l-4 border-l-[hsl(var(--status-vinculado))]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--status-vinculado))]" />
              Resumo da Importação (Mock)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Resultado da importação</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {resumoImportacaoItems.map((item) => (
                  <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-dashed p-3">
              {/* Pendência de layout mantida no mock, mas fora dos indicadores centrais para não conflitar com o resultado da carga. */}
              <p className="text-xs text-muted-foreground">
                Pendências de layout identificadas na leitura: <span className="font-semibold text-foreground">{importResumoMock.pendentesLayout}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Estado atual na conferência</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {resumoConferenciaItems.map((item) => (
                  <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
