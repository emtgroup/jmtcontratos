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

const toFriendlyAlias = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized) return "";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const tipoColunaOptions = [
  "Contrato vinculado",
  "Nota fiscal",
  "Contrato interno",
  "Placa",
  "Peso fiscal",
  "Peso líquido",
  "Data da nota",
  "Hora",
  "Produto",
  "Observação NF",
  "Chave de acesso",
  "Clifor",
  "Nome cooperativa",
];

const tipoSemantica: Record<string, { categoria: string; destaque?: string }> = {
  // "Contrato vinculado" participa da chave fixa; "Contrato interno" é referência Maxys apenas informativa.
  "Contrato vinculado": { categoria: "Identificação principal", destaque: "Campo principal" },
  "Nota fiscal": { categoria: "Identificação principal", destaque: "Campo principal" },
  // "Contrato interno" não entra em chave, matching ou diagnóstico: é campo de contexto operacional.
  "Contrato interno": { categoria: "Detalhe / exibição" },
  Placa: { categoria: "Apoio" },
  "Peso fiscal": { categoria: "Informativo" },
  "Peso líquido": { categoria: "Informativo" },
  "Data da nota": { categoria: "Detalhe / exibição" },
  Hora: { categoria: "Detalhe / exibição" },
  Produto: { categoria: "Detalhe / exibição" },
  "Observação NF": { categoria: "Detalhe / exibição" },
  "Chave de acesso": { categoria: "Detalhe / exibição" },
  Clifor: { categoria: "Detalhe / exibição" },
  // "Nome cooperativa" é informativo para exibição e não entra em chave/matching.
  "Nome cooperativa": { categoria: "Detalhe / exibição" },
};

const getTipoSemantica = (tipo: string) => tipoSemantica[tipo] ?? { categoria: "Detalhe / exibição" };

// Textos curtos de apoio para reduzir dúvidas no mapeamento das colunas.
const columnHelpText = {
  nomeColunaExcel: "Informe a letra ou nome da coluna conforme aparece no arquivo (ex: A, B, C ou Nome da coluna no Excel).",
  apelido: "Nome interno utilizado pelo sistema para identificar a coluna. Não precisa ser igual ao Excel.",
  // Texto orientado à nova taxonomia de tipos para reduzir ambiguidades no cadastro.
  tipoColuna: "Define o significado da coluna no sistema: identificação principal (Contrato vinculado/Nota fiscal), apoio (Placa), informativos (Peso fiscal/Peso líquido) e detalhe/exibição (Contrato interno, Data da nota, Hora, Produto, Observação NF, Chave de acesso, Clifor e Nome cooperativa).",
  // Microcopy explícita para reduzir interpretação incorreta do checkbox na etapa de configuração.
  analise: "Indica participação em análises visuais da conferência. Não define chave, não define matching e não altera regra central do sistema.",
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
  const [baseValidationErrors, setBaseValidationErrors] = useState<string[]>([]);
  const [baseSaveFeedback, setBaseSaveFeedback] = useState("");
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

  const updateBaseColumnExcelName = (id: string, colunaExcel: string) => {
    setBaseColumns(baseColumns.map((col) => {
      if (col.id !== id) return col;

      const previousAutoAlias = toFriendlyAlias(col.colunaExcel);
      const nextAutoAlias = toFriendlyAlias(colunaExcel);
      // Sugestão automática: preenche quando vazio e sincroniza apenas enquanto o apelido ainda for auto-gerado.
      const shouldSyncAlias = !col.apelido.trim() || col.apelido === previousAutoAlias;

      return {
        ...col,
        colunaExcel,
        apelido: shouldSyncAlias ? nextAutoAlias : col.apelido,
      };
    }));
  };

  const updateBaseColumnAlias = (id: string, apelido: string) => {
    // Edição manual é soberana: após alteração do usuário, o auto-preenchimento não sobrescreve mais.
    setBaseColumns(baseColumns.map((col) => (col.id === id ? { ...col, apelido } : col)));
  };

  const handleSaveBaseMapping = () => {
    const contratoVinculadoCount = baseColumns.filter((col) => col.tipo === "Contrato vinculado").length;
    const notaFiscalCount = baseColumns.filter((col) => col.tipo === "Nota fiscal").length;
    const errors: string[] = [];

    // Validação mínima obrigatória: os únicos tipos estruturais exigidos continuam sendo Contrato vinculado e Nota fiscal.
    if (contratoVinculadoCount !== 1) {
      errors.push("O layout base deve ter exatamente 1 coluna do tipo Contrato vinculado.");
    }

    if (notaFiscalCount !== 1) {
      errors.push("O layout base deve ter exatamente 1 coluna do tipo Nota fiscal.");
    }

    setBaseValidationErrors(errors);
    setBaseSaveFeedback(errors.length === 0 ? "Mapeamento válido para o Layout Base." : "");
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
                <Button size="sm" onClick={handleSaveBaseMapping}>
                  <Save className="h-4 w-4 mr-1" /> Salvar Mapeamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {baseValidationErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 mb-4 text-xs text-destructive space-y-1">
                  {baseValidationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
              {baseSaveFeedback && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 mb-4 text-xs text-emerald-700">
                  {baseSaveFeedback}
                </div>
              )}
              <div className="rounded-md border bg-muted/30 p-3 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  O usuário define o significado das colunas; o sistema usa esse mapeamento na leitura e conferência. Contrato vinculado e Nota fiscal são identificação principal, Placa é apoio, Peso fiscal e Peso líquido são informativos, e Contrato interno/Data da nota/Hora/Produto/Observação NF/Chave de acesso/Clifor/Nome cooperativa compõem os campos de detalhe e exibição.
                </span>
              </div>
              <div className="rounded-md border border-dashed p-3 mb-4 text-xs text-muted-foreground">
                {/* Reforço pontual do PRD para evitar leitura equivocada sobre o campo Análise. */}
                <span className="font-medium text-foreground">Campo "Análise":</span> apoio de exibição. Não define chave, não define matching e não altera a regra central.
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
                    {/* Ajuste de largura da grade: Nome da Coluna Excel ganha espaço para ficar proporcional ao Apelido. */}
                    <TableHead className="w-[28%]">{renderHeaderWithHelp("Nome da Coluna Excel", columnHelpText.nomeColunaExcel)}</TableHead>
                    <TableHead className="w-[28%]">{renderHeaderWithHelp("Apelido", columnHelpText.apelido)}</TableHead>
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
                          <Input
                            value={col.colunaExcel}
                            onChange={(event) => updateBaseColumnExcelName(col.id, event.target.value)}
                            className="h-8 w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={col.apelido}
                            onChange={(event) => updateBaseColumnAlias(col.id, event.target.value)}
                            className="h-8 w-full"
                          />
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
                  O mapeamento complementar segue a mesma semântica da base: Contrato vinculado e Nota fiscal identificam registros, Placa é apoio, Peso fiscal e Peso líquido são informativos, e Contrato interno/Data da nota/Hora/Produto/Observação NF/Chave de acesso/Clifor/Nome cooperativa são campos de detalhe e exibição.
                </span>
              </div>
              <div className="rounded-md border border-dashed p-3 mb-4 text-xs text-muted-foreground">
                {/* Alinhamento textual entre Base e Complementar: layout mapeia significado, sistema define comportamento. */}
                Regra igual ao Layout Base: o usuário define o significado da coluna e o sistema aplica a lógica (chave e matching não são configuráveis nesta tela).
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
