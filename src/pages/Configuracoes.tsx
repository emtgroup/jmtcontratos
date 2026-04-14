import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { layoutBaseColumns, layoutsComplementares, LayoutColumn } from "@/data/mock";
import { Plus, Save, Trash2, Info } from "lucide-react";

const tipoColunaOptions = [
  "Contrato vinculado",
  "Nota fiscal",
  "Placa",
  "Peso fiscal",
  "Peso líquido",
  "Data",
  "Clifor",
  "Outros",
];

export default function Configuracoes() {
  const [baseColumns, setBaseColumns] = useState<LayoutColumn[]>(layoutBaseColumns);
  const [showNewLayout, setShowNewLayout] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");
  const [newLayoutCols, setNewLayoutCols] = useState<LayoutColumn[]>([
    { id: "n1", colunaExcel: "", apelido: "", tipo: "Contrato vinculado", analise: true },
  ]);

  const addBaseColumn = () => {
    setBaseColumns([...baseColumns, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "Outros", analise: false }]);
  };

  const removeBaseColumn = (id: string) => {
    setBaseColumns(baseColumns.filter((c) => c.id !== id));
  };

  const addNewLayoutCol = () => {
    setNewLayoutCols([...newLayoutCols, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "Outros", analise: true }]);
  };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Gerencie o mapeamento de colunas da conferência (base e complementares)" />

      <Tabs defaultValue="base">
        <TabsList className="mb-4">
          <TabsTrigger value="base">Layout Base (GRL053)</TabsTrigger>
          <TabsTrigger value="complementares">Layouts Complementares</TabsTrigger>
        </TabsList>

        {/* BASE TAB */}
        <TabsContent value="base">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mapeamento de Colunas — GRL053</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addBaseColumn}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Coluna
                </Button>
                <Button size="sm">
                  <Save className="h-4 w-4 mr-1" /> Salvar Configuração
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-3 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Defina o significado de cada coluna do arquivo; o sistema usará esse mapeamento para interpretar os dados (interface mockada, sem motor real de importação).</span>
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
                    <TableHead>Coluna Excel</TableHead>
                    <TableHead>Apelido</TableHead>
                    <TableHead>Tipo da Coluna</TableHead>
                    <TableHead className="text-center">Análise</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baseColumns.map((col) => (
                    <TableRow key={col.id}>
                      <TableCell>
                        <Input defaultValue={col.colunaExcel} className="h-8 w-20" />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={col.apelido} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Select defaultValue={col.tipo}>
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
                  ))}
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
                <Plus className="h-4 w-4 mr-1" /> Novo Layout
              </Button>
            </CardHeader>
            <CardContent>
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
                    <label className="text-sm font-medium">Nome do Layout:</label>
                    <Input value={newLayoutName} onChange={(e) => setNewLayoutName(e.target.value)} placeholder="Ex: Bunge - Recebimento" className="h-8 max-w-xs" />
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
                        <TableHead>Coluna Excel</TableHead>
                        <TableHead>Apelido</TableHead>
                        <TableHead>Tipo da Coluna</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newLayoutCols.map((col) => (
                        <TableRow key={col.id}>
                          <TableCell><Input className="h-8 w-20" /></TableCell>
                          <TableCell><Input className="h-8" placeholder="Ex: Nota Fiscal" /></TableCell>
                          <TableCell>
                            <Select defaultValue={col.tipo}>
                              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {tipoColunaOptions.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
