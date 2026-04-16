import { useState, useEffect, useCallback } from "react";
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
import { layoutsComplementares } from "@/data/mock";
import { Plus, Save, Trash2, Info, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchLayoutBase,
  saveLayoutBase,
  LayoutBaseColuna,
  LayoutBase,
} from "@/services/layoutBaseService";

// --- Helpers de apelido automático ---
const toFriendlyAlias = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

// --- Tipos de coluna permitidos (lista fechada conforme PRD) ---
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

// --- Semântica visual dos tipos ---
const tipoSemantica: Record<string, { categoria: string; destaque?: string }> = {
  "Contrato vinculado": { categoria: "Identificação principal", destaque: "Campo principal" },
  "Nota fiscal": { categoria: "Identificação principal", destaque: "Campo principal" },
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
  "Nome cooperativa": { categoria: "Detalhe / exibição" },
};

const getTipoSemantica = (tipo: string) => tipoSemantica[tipo] ?? { categoria: "Detalhe / exibição" };

// --- Tooltips de ajuda ---
const columnHelpText = {
  nomeColunaExcel: "Informe a letra ou nome da coluna conforme aparece no arquivo (ex: A, B, C ou Nome da coluna no Excel).",
  apelido: "Nome interno utilizado pelo sistema para identificar a coluna. Não precisa ser igual ao Excel.",
  tipoColuna: "Define o significado da coluna no sistema: identificação principal (Contrato vinculado/Nota fiscal), apoio (Placa), informativos (Peso fiscal/Peso líquido) e detalhe/exibição (Contrato interno, Data da nota, Hora, Produto, Observação NF, Chave de acesso, Clifor e Nome cooperativa).",
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
  // --- Estado do layout base ---
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [linhaCabecalho, setLinhaCabecalho] = useState(2);
  const [linhaDados, setLinhaDados] = useState(3);
  const [baseColumns, setBaseColumns] = useState<LayoutBaseColuna[]>([]);
  const [baseValidationErrors, setBaseValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Estado de layouts complementares (ainda mock) ---
  const [showNewLayout, setShowNewLayout] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");
  const [newLayoutCols, setNewLayoutCols] = useState<LayoutBaseColuna[]>([
    { id: "n1", nome_coluna_excel: "", apelido: "", tipo_coluna: "Contrato vinculado", analise: true, ordem: 0, _isNew: true },
  ]);

  // --- Carregamento inicial do banco ---
  const loadLayoutBase = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchLayoutBase();
      if (result) {
        setLayoutId(result.layout.id);
        setLinhaCabecalho(result.layout.linha_cabecalho);
        setLinhaDados(result.layout.linha_dados);
        setBaseColumns(result.colunas);
      } else {
        // Nenhum layout no banco — iniciar vazio
        setLayoutId(null);
        setBaseColumns([]);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar layout base", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayoutBase();
  }, [loadLayoutBase]);

  // --- Ações de coluna ---

  const addBaseColumn = () => {
    setBaseColumns([
      ...baseColumns,
      {
        id: `new-${Date.now()}`,
        nome_coluna_excel: "",
        apelido: "",
        tipo_coluna: "Data da nota",
        analise: false,
        ordem: baseColumns.length,
        _isNew: true,
      },
    ]);
  };

  const removeBaseColumn = (id: string) => {
    setBaseColumns(baseColumns.filter((c) => c.id !== id));
  };

  const updateBaseColumnField = (id: string, field: keyof LayoutBaseColuna, value: any) => {
    setBaseColumns(baseColumns.map((col) => (col.id === id ? { ...col, [field]: value } : col)));
  };

  /** Atualiza nome da coluna Excel e auto-preenche apelido se ainda não foi editado manualmente */
  const updateBaseColumnExcelName = (id: string, nomeExcel: string) => {
    setBaseColumns(baseColumns.map((col) => {
      if (col.id !== id) return col;
      const previousAutoAlias = toFriendlyAlias(col.nome_coluna_excel);
      const nextAutoAlias = toFriendlyAlias(nomeExcel);
      const shouldSyncAlias = !col.apelido.trim() || col.apelido === previousAutoAlias;
      return {
        ...col,
        nome_coluna_excel: nomeExcel,
        apelido: shouldSyncAlias ? nextAutoAlias : col.apelido,
      };
    }));
  };

  // --- Validação e salvamento ---

  const validateColumns = (cols: LayoutBaseColuna[]): string[] => {
    const errors: string[] = [];

    const contratoCount = cols.filter((c) => c.tipo_coluna === "Contrato vinculado").length;
    const notaCount = cols.filter((c) => c.tipo_coluna === "Nota fiscal").length;

    if (contratoCount !== 1) {
      errors.push("O layout base deve ter exatamente 1 coluna do tipo 'Contrato vinculado'.");
    }
    if (notaCount !== 1) {
      errors.push("O layout base deve ter exatamente 1 coluna do tipo 'Nota fiscal'.");
    }

    // Nome da coluna Excel não pode ser vazio
    const vazios = cols.filter((c) => !c.nome_coluna_excel.trim());
    if (vazios.length > 0) {
      errors.push(`${vazios.length} coluna(s) com nome Excel vazio. Preencha todos os campos.`);
    }

    // Nome da coluna Excel não pode ser duplicado
    const nomes = cols.map((c) => c.nome_coluna_excel.trim().toUpperCase()).filter(Boolean);
    const duplicados = nomes.filter((n, i) => nomes.indexOf(n) !== i);
    if (duplicados.length > 0) {
      errors.push(`Nome de coluna Excel duplicado: ${[...new Set(duplicados)].join(", ")}`);
    }

    return errors;
  };

  const handleSaveBaseMapping = async () => {
    // 1. Validar antes de qualquer operação
    const errors = validateColumns(baseColumns);
    setBaseValidationErrors(errors);

    if (errors.length > 0) {
      toast.error("Mapeamento inválido", { description: "Corrija os erros indicados antes de salvar." });
      return;
    }

    // 2. Persistir no banco
    setIsSaving(true);
    try {
      const result = await saveLayoutBase(
        { id: layoutId ?? undefined, linha_cabecalho: linhaCabecalho, linha_dados: linhaDados } as any,
        baseColumns
      );

      // 3. Atualizar estado com dados reais do banco (fonte da verdade)
      setLayoutId(result.layout.id);
      setLinhaCabecalho(result.layout.linha_cabecalho);
      setLinhaDados(result.layout.linha_dados);
      setBaseColumns(result.colunas);
      setBaseValidationErrors([]);

      toast.success("Mapeamento salvo com sucesso", { description: "Os dados foram persistidos no banco." });
    } catch (err: any) {
      toast.error("Erro ao salvar mapeamento", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Layouts complementares (ainda mock — inalterado) ---

  const addNewLayoutCol = () => {
    setNewLayoutCols([
      ...newLayoutCols,
      { id: `new-${Date.now()}`, nome_coluna_excel: "", apelido: "", tipo_coluna: "Data da nota", analise: true, ordem: newLayoutCols.length, _isNew: true },
    ]);
  };

  const updateNewLayoutColTipo = (id: string, tipo: string) => {
    setNewLayoutCols(newLayoutCols.map((col) => (col.id === id ? { ...col, tipo_coluna: tipo } : col)));
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Configurações de Layout" subtitle="Carregando..." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configurações de Layout" subtitle="Mapeie colunas da Base GRL053 e de relatórios externos complementares" />

      <Tabs defaultValue="base">
        <TabsList className="mb-4">
          <TabsTrigger value="base">Layout Base (GRL053)</TabsTrigger>
          <TabsTrigger value="complementares">Layouts Complementares</TabsTrigger>
        </TabsList>

        {/* ========== BASE TAB ========== */}
        <TabsContent value="base">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Layout Base (GRL053) — Mapeamento de Colunas</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addBaseColumn} disabled={isSaving}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Coluna
                </Button>
                <Button size="sm" onClick={handleSaveBaseMapping} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar Mapeamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Erros de validação */}
              {baseValidationErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 mb-4 text-xs text-destructive space-y-1">
                  {baseValidationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}

              {/* Banner informativo */}
              <div className="rounded-md border bg-muted/30 p-3 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  O usuário define o significado das colunas; o sistema usa esse mapeamento na leitura e conferência. Contrato vinculado e Nota fiscal são identificação principal, Placa é apoio, Peso fiscal e Peso líquido são informativos, e os demais são campos de detalhe e exibição.
                </span>
              </div>
              <div className="rounded-md border border-dashed p-3 mb-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Campo "Análise":</span> apoio de exibição. Não define chave, não define matching e não altera a regra central.
              </div>

              {/* Configuração de linhas iniciais */}
              <div className="rounded-md border p-3 mb-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Configure de qual linha o sistema começa a ler o cabeçalho e os dados do arquivo.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Linha inicial do cabeçalho</label>
                    <Input
                      type="number"
                      value={linhaCabecalho}
                      onChange={(e) => setLinhaCabecalho(Number(e.target.value) || 1)}
                      className="h-8"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Linha inicial dos dados</label>
                    <Input
                      type="number"
                      value={linhaDados}
                      onChange={(e) => setLinhaDados(Number(e.target.value) || 1)}
                      className="h-8"
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>

              {/* Tabela de colunas */}
              {baseColumns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhuma coluna configurada</p>
                  <p className="text-xs mt-1">Clique em "Adicionar Coluna" para começar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[28%]">{renderHeaderWithHelp("Nome da Coluna Excel", columnHelpText.nomeColunaExcel)}</TableHead>
                      <TableHead className="w-[28%]">{renderHeaderWithHelp("Apelido", columnHelpText.apelido)}</TableHead>
                      <TableHead>{renderHeaderWithHelp("Tipo da Coluna", columnHelpText.tipoColuna)}</TableHead>
                      <TableHead className="text-center">{renderHeaderWithHelp("Análise", columnHelpText.analise)}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baseColumns.map((col) => {
                      const semantica = getTipoSemantica(col.tipo_coluna);
                      const isPrincipal = col.tipo_coluna === "Contrato vinculado" || col.tipo_coluna === "Nota fiscal";

                      return (
                        <TableRow key={col.id}>
                          <TableCell>
                            <Input
                              value={col.nome_coluna_excel}
                              onChange={(e) => updateBaseColumnExcelName(col.id, e.target.value)}
                              className="h-8 w-full"
                              disabled={isSaving}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={col.apelido}
                              onChange={(e) => updateBaseColumnField(col.id, "apelido", e.target.value)}
                              className="h-8 w-full"
                              disabled={isSaving}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <Select
                                value={col.tipo_coluna}
                                onValueChange={(value) => updateBaseColumnField(col.id, "tipo_coluna", value)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue />
                                </SelectTrigger>
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={col.analise}
                              onCheckedChange={(checked) => updateBaseColumnField(col.id, "analise", !!checked)}
                              disabled={isSaving}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeBaseColumn(col.id)}
                              disabled={isSaving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== COMPLEMENTARES TAB (ainda mock) ========== */}
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
                  O mapeamento complementar segue a mesma semântica da base: Contrato vinculado e Nota fiscal identificam registros, Placa é apoio, Peso fiscal e Peso líquido são informativos, e os demais são campos de detalhe e exibição.
                </span>
              </div>
              <div className="rounded-md border border-dashed p-3 mb-4 text-xs text-muted-foreground">
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
                    <span>Mapeie o significado das colunas para interpretação do arquivo e configure a linha inicial de leitura.</span>
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
                        const semantica = getTipoSemantica(col.tipo_coluna);
                        const isPrincipal = col.tipo_coluna === "Contrato vinculado" || col.tipo_coluna === "Nota fiscal";
                        return (
                          <TableRow key={col.id}>
                            <TableCell><Input className="h-8 w-20" placeholder="Ex: C" /></TableCell>
                            <TableCell><Input className="h-8" placeholder="Ex: Nota Fiscal" /></TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Select value={col.tipo_coluna} onValueChange={(value) => updateNewLayoutColTipo(col.id, value)}>
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
