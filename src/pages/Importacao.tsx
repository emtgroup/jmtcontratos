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

  const handleImport = () => setShowResumo(true);

  const resumoItems = [
    { label: "Total Lido", value: importResumoMock.totalLido },
    { label: "Inseridos", value: importResumoMock.inseridos },
    { label: "Atualizados", value: importResumoMock.atualizados },
    { label: "Ignorados", value: importResumoMock.ignorados },
    { label: "Vinculados", value: importResumoMock.vinculados },
    { label: "Aguardando", value: importResumoMock.aguardando },
    { label: "Divergentes", value: importResumoMock.divergentes },
    { label: "Ambíguos", value: importResumoMock.ambiguos },
  ];

  return (
    <div>
      <PageHeader title="Importação de Dados" subtitle="Importe arquivos da base principal ou relatórios complementares" />

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Base */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base GRL053</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Layout</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fs">FS Bioenergia</SelectItem>
                  <SelectItem value="bunge">Bunge</SelectItem>
                  <SelectItem value="inpasa">Inpasa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <UploadArea title="Arquivo Complementar" subtitle="Formato: .xlsx, .csv" />
            <Button className="w-full" variant="secondary" onClick={handleImport}>Importar Complementar</Button>
          </CardContent>
        </Card>
      </div>

      {/* Resumo */}
      {showResumo && (
        <Card className="border-l-4 border-l-[hsl(var(--status-vinculado))]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--status-vinculado))]" />
              Importação Concluída (Mock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {resumoItems.map((item) => (
                <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
