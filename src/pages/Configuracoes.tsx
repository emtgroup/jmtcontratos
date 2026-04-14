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

const tipoOptions = ["texto", "numero", "moeda", "data", "booleano"];

export default function Configuracoes() {
  const [baseColumns, setBaseColumns] = useState<LayoutColumn[]>(layoutBaseColumns);
  const [showNewLayout, setShowNewLayout] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");
  const [newLayoutCols, setNewLayoutCols] = useState<LayoutColumn[]>([
    { id: "n1", colunaExcel: "", apelido: "", tipo: "texto", analise: true },
  ]);

  const addBaseColumn = () => {
    setBaseColumns([...baseColumns, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "texto", analise: false }]);
  };

  const removeBaseColumn = (id: string) => {
    setBaseColumns(baseColumns.filter((c) => c.id !== id));
  };

  const addNewLayoutCol = () => {
    setNewLayoutCols([...newLayoutCols, { id: String(Date.now()), colunaExcel: "", apelido: "", tipo: "texto", analise: true }]);
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
                {/* Mensagem revisada para refletir os campos oficiais, mantendo comportamento somente mock. */}
                <span>Defina o mapeamento entre as colunas do arquivo e campos como Contrato Vinculado, Nota Fiscal, Placa, Peso Fiscal, Peso Líquido, Data e Clifor.</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna Excel</TableHead>
                    <TableHead>Apelido</TableHead>
                    <TableHead>Tipo do Sistema</TableHead>
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
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tipoOptions.map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
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
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Nome do Layout:</label>
                    <Input value={newLayoutName} onChange={(e) => setNewLayoutName(e.target.value)} placeholder="Ex: Bunge - Recebimento" className="h-8 max-w-xs" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coluna Excel</TableHead>
                        <TableHead>Apelido</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newLayoutCols.map((col) => (
                        <TableRow key={col.id}>
                          <TableCell><Input className="h-8 w-20" /></TableCell>
                          <TableCell><Input className="h-8" placeholder="Ex: Nota Fiscal" /></TableCell>
                          <TableCell>
                            <Select defaultValue="texto">
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {tipoOptions.map((t) => (
                                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
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
