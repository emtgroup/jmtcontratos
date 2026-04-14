import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { layoutBaseColumns, layoutsComplementares, LayoutColumn } from "@/data/mock";
import { Plus, Save, Trash2, Info, HelpCircle } from "lucide-react";

const tipoColunaOptions = [
  "Contrato vinculado",
  "Nota fiscal",
  "Placa",
  "Peso fiscal",
  "Peso líquido",
  "Data da nota",
  "Hora",
  "Produto",
  "Observação NF",
  "Chave de acesso",
  "Clifor",
];

const tipoSemantica: Record<string, { categoria: string; destaque?: string }> = {
  // Semântica fechada para preparar integração com backend sem depender de tipo genérico.
  "Contrato vinculado": { categoria: "Identificação principal", destaque: "Campo principal" },
  "Nota fiscal": { categoria: "Identificação principal", destaque: "Campo principal" },
  Placa: { categoria: "Apoio" },
  "Peso fiscal": { categoria: "Informativo" },
  "Peso líquido": { categoria: "Informativo" },
  "Data da nota": { categoria: "Detalhe / exibição" },
  Hora: { categoria: "Detalhe / exibição" },
  Produto: { categoria: "Detalhe / exibição" },
  "Observação NF": { categoria: "Detalhe / exibição" },
  "Chave de acesso": { categoria: "Detalhe / exibição" },
  Clifor: { categoria: "Detalhe / exibição" },
};

const getTipoSemantica = (tipo: string) => tipoSemantica[tipo] ?? { categoria: "Detalhe / exibição" };

// Textos curtos de apoio para reduzir dúvidas no mapeamento das colunas.
const columnHelpText = {
  nomeColunaExcel: "Informe a letra ou nome da coluna conforme aparece no arquivo (ex: A, B, C ou Nome da coluna no Excel).",
  apelido: "Nome interno utilizado pelo sistema para identificar a coluna. Não precisa ser igual ao Excel.",
  // Texto orientado à nova taxonomia de tipos para reduzir ambiguidades no cadastro.
  tipoColuna: "Define o significado da coluna no sistema: identificação principal (Contrato vinculado/Nota fiscal), apoio (Placa), informativos (Peso fiscal/Peso líquido) e detalhe/exibição (Data da nota, Hora, Produto, Observação NF, Chave de acesso e Clifor).",
  analise: "Indica se essa coluna será considerada na conferência e comparação dos dados.",
};

const renderHeaderWithHelp = (title: string, tooltipText: string) => (
  <div className="inline-flex items-center gap-1.5">
    <span>{title}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={`Ajuda sobre ${title}`}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  </div>
);

export default function Configuracoes() {
  const [baseColumns, setBaseColumns] = useState<LayoutColumn[]>(layoutBaseColumns);
  const [showNewLayout, setShowNewLayout] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");
  const [newLayoutCols, setNewLayoutCols] = useState<LayoutColumn[]>([
    { id: "n1", colunaExcel: "", apelido: "", tipo: "Contrato vinculado", analise: true },
  ]);

  const addBaseColumn = () => {
    // Novo item já nasce com tipo permitido da lista final para manter coerência do mock com backend futuro.
    setBaseColumns([...baseColumns, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "Data da nota", analise: false }]);
  };

  const removeBaseColumn = (id: string) => {
    setBaseColumns(baseColumns.filter((c) => c.id !== id));
  };

  const updateBaseColumnTipo = (id: string, tipo: string) => {
    setBaseColumns(baseColumns.map((col) => (col.id === id ? { ...col, tipo } : col)));
  };

  const addNewLayoutCol = () => {
    // Evita fallback genérico: todo novo campo complementar começa em tipo específico.
    setNewLayoutCols([...newLayoutCols, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "Data da nota", analise: true }]);
  };

  const updateNewLayoutColTipo = (id: string, tipo: string) => {
    setNewLayoutCols(newLayoutCols.map((col) => (col.id === id ? { ...col, tipo } : col)));
  };

  return (
    <div>
      <PageHeader title="Configurações de Layout" subtitle="Mapeie colunas da Base GRL053 e de relatórios externos complementares (mock)" />

      <Tabs defaultValue="base">
        <TabsList className="mb-4">
          <TabsTrigger value="base">Layout Base (GRL053)</TabsTrigger>
          <TabsTrigger value="complementares">Layouts Complementares</TabsTrigger>
        </TabsList>

        {/* BASE TAB */}
        <TabsContent value="base">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Layout Base (GRL053) — Mapeamento de Colunas</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addBaseColumn}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Coluna
                </Button>
                <Button size="sm">
                  <Save className="h-4 w-4 mr-1" /> Salvar Mapeamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-3 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  O usuário define o significado das colunas; o sistema usa esse mapeamento na leitura e conferência. Contrato vinculado e Nota fiscal são identificação principal, Placa é apoio, Peso fiscal e Peso líquido são informativos, e Data da nota/Hora/Produto/Observação NF/Chave de acesso/Clifor compõem os campos de detalhe e exibição.
                </span>
              </div>
              {/* Preparação visual para futura lógica de leitura, mantendo a tela em modo mock. */}
              <div className="rounded-md border p-3 mb-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Configure de qual linha o sistema começa a ler o cabeçalho e os dados do arquivo.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Linha inicial do cabeçalho</label>
                    <Input type="number" defaultValue={2} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Linha inicial dos dados</label>
                    <Input type="number" defaultValue={3} className="h-8" />
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{renderHeaderWithHelp("Nome da Coluna Excel", columnHelpText.nomeColunaExcel)}</TableHead>
                    <TableHead>{renderHeaderWithHelp("Apelido", columnHelpText.apelido)}</TableHead>
                    <TableHead>{renderHeaderWithHelp("Tipo da Coluna", columnHelpText.tipoColuna)}</TableHead>
                    <TableHead className="text-center">{renderHeaderWithHelp("Análise", columnHelpText.analise)}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baseColumns.map((col) => {
                    const semantica = getTipoSemantica(col.tipo);
                    const isPrincipal = col.tipo === "Contrato vinculado" || col.tipo === "Nota fiscal";

                    return (
                      <TableRow key={col.id}>
                        <TableCell>
                          <Input defaultValue={col.colunaExcel} className="h-8 w-20" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={col.apelido} className="h-8" />
                        </TableCell>
                        <TableCell>
                          {/* Destaque visual sem bloquear fluxo: sem validação funcional nesta fase mock. */}
                          <div className="space-y-1.5">
                            <Select value={col.tipo} onValueChange={(value) => updateBaseColumnTipo(col.id, value)}>
                              <SelectTrigger className="h-8 w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Tipo da coluna orientado a negócio para refletir o conceito do sistema. */}
                                {tipoColunaOptions.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant={isPrincipal ? "default" : "secondary"} className="h-5 text-[10px]">
                                {semantica.categoria}
                              </Badge>
                              {semantica.destaque && (
                                <span className="text-[10px] text-muted-foreground">{semantica.destaque}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox defaultChecked={col.analise} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeBaseColumn(col.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPLEMENTARES TAB */}
        <TabsContent value="complementares">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Layouts Complementares</CardTitle>
              <Button size="sm" onClick={() => setShowNewLayout(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Layout Complementar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-3 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  O mapeamento complementar segue a mesma semântica da base: Contrato vinculado e Nota fiscal identificam registros, Placa é apoio, Peso fiscal e Peso líquido são informativos, e Data da nota/Hora/Produto/Observação NF/Chave de acesso/Clifor são campos de detalhe e exibição.
                </span>
              </div>
              {layoutsComplementares.length === 0 && !showNewLayout && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhum layout complementar cadastrado</p>
                  <p className="text-xs mt-1">Clique em &quot;Novo Layout&quot; para começar</p>
                </div>
              )}

              {showNewLayout && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="rounded-md border bg-muted/30 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Mapeie o significado das colunas para interpretação do arquivo e configure a linha inicial de leitura (mock visual, sem processamento real).</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Nome do Layout Externo:</label>
                    <Input value={newLayoutName} onChange={(e) => setNewLayoutName(e.target.value)} placeholder="Ex: Bunge - Recebimento Rodoviário" className="h-8 max-w-xs" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Linha inicial do cabeçalho</label>
                      <Input type="number" defaultValue={2} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Linha inicial dos dados</label>
                      <Input type="number" defaultValue={3} className="h-8" />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{renderHeaderWithHelp("Coluna Excel", columnHelpText.nomeColunaExcel)}</TableHead>
                        <TableHead>{renderHeaderWithHelp("Apelido", columnHelpText.apelido)}</TableHead>
                        <TableHead>{renderHeaderWithHelp("Tipo da Coluna", columnHelpText.tipoColuna)}</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newLayoutCols.map((col) => {
                        const semantica = getTipoSemantica(col.tipo);
                        const isPrincipal = col.tipo === "Contrato vinculado" || col.tipo === "Nota fiscal";

                        return (
                          <TableRow key={col.id}>
                            <TableCell><Input className="h-8 w-20" placeholder="Ex: C" /></TableCell>
                            <TableCell><Input className="h-8" placeholder="Ex: Nota Fiscal" /></TableCell>
                            <TableCell>
                              {/* Destaque apenas semântico/visual; regras de validação ficam para etapa funcional. */}
                              <div className="space-y-1.5">
                                <Select value={col.tipo} onValueChange={(value) => updateNewLayoutColTipo(col.id, value)}>
                                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {tipoColunaOptions.map((t) => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge variant={isPrincipal ? "default" : "secondary"} className="h-5 text-[10px]">
                                    {semantica.categoria}
                                  </Badge>
                                  {semantica.destaque && (
                                    <span className="text-[10px] text-muted-foreground">{semantica.destaque}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addNewLayoutCol}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Coluna
                    </Button>
                    <Button size="sm"><Save className="h-4 w-4 mr-1" /> Salvar Layout</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewLayout(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
