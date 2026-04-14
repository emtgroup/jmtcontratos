import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { conferenciaRecords, ConferenciaRecord, StatusType } from "@/data/mock";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Download, Copy } from "lucide-react";

const statusFilters: (StatusType | "todos")[] = ["todos", "vinculado", "aguardando", "divergente", "ambiguo"];

export default function Conferencia() {
  const [activeFilter, setActiveFilter] = useState<StatusType | "todos">("todos");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ConferenciaRecord | null>(null);

  const filtered = conferenciaRecords.filter((r) => {
    if (activeFilter !== "todos" && r.status !== activeFilter) return false;
    if (search && !r.contrato.toLowerCase().includes(search.toLowerCase()) && !r.nota.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasDivergence = !!selectedRecord && selectedRecord.comparacaoBase !== selectedRecord.comparacaoComplementar;

  return (
    <div>
      <PageHeader title="Módulo de Conferência" subtitle="Visualização do resultado da conferência entre Base GRL053 e layouts complementares (mock)">
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Exportar</Button>
      </PageHeader>

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-xs text-muted-foreground">
          {/* Observação explícita para reforçar que esta tela exibe resultado mockado e não executa decisão de negócio. */}
          A conferência abaixo é apenas uma exibição de resultado em modo mock. O status é exibido para análise operacional e não é decidido nesta tela.
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contrato ou nota..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((s) => (
            <Button key={s} variant={activeFilter === s ? "default" : "outline"} size="sm" onClick={() => setActiveFilter(s)} className="capitalize text-xs">
              {s === "todos" ? "Todos" : s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Chave Determinística</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Data NF</TableHead>
                <TableHead>Placa</TableHead>
                {/* Nomenclaturas padronizadas para aderência ao contexto real do projeto. */}
                <TableHead className="text-right">Peso Fiscal</TableHead>
                <TableHead className="text-right">Peso Líquido</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedRecord(r)}>
                  {/* Badge com variação sólida para leitura operacional mais rápida na tela de conferência. */}
                  <TableCell><StatusBadge status={r.status} variant="solid" /></TableCell>
                  <TableCell className="font-mono text-xs">{r.chaveDeterministica}</TableCell>
                  <TableCell className="font-medium">{r.contrato}</TableCell>
                  {/* Clique direto na nota também abre o painel lateral para investigação sem sair da tela. */}
                  <TableCell className="underline-offset-2 hover:underline">{r.nota}</TableCell>
                  <TableCell>{r.dataNF}</TableCell>
                  <TableCell>{r.placa}</TableCell>
                  <TableCell className="text-right">{r.pesoBase.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{r.pesoComplementar?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                  {/* Motivo é exibido de forma textual para clareza operacional sem alterar regras/filtros. */}
                  <TableCell>{r.motivo}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-vinculado))]" />
          Vinculado (resultado exibido)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-ambiguo))]" />
          Ambíguo (requer revisão operacional)
        </div>
        <div>
          Peso Fiscal e Peso Líquido são informativos nesta etapa mockada.
        </div>
      </div>

      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da nota</SheetTitle>
            <SheetDescription>
              Painel lateral com dados mockados para investigação sem mudar status nesta tela.
            </SheetDescription>
          </SheetHeader>

          {selectedRecord && (
            <div className="mt-6 space-y-6 text-sm">
              {/* Seção de identificação da nota para contexto operacional rápido. */}
              <section className="space-y-3">
                <h3 className="font-semibold">Identificação</h3>
                <div className="grid grid-cols-1 gap-2">
                  <p><span className="text-muted-foreground">Contrato vinculado:</span> {selectedRecord.contrato}</p>
                  <p><span className="text-muted-foreground">Nota fiscal:</span> {selectedRecord.nota}</p>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Chave de acesso</p>
                    <div className="flex items-center gap-2 rounded-md border p-2 font-mono text-xs break-all">
                      <span>{selectedRecord.chaveAcesso}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => navigator.clipboard.writeText(selectedRecord.chaveAcesso)}
                        aria-label="Copiar chave de acesso"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p><span className="text-muted-foreground">Clifor:</span> {selectedRecord.clifor}</p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Dados da NF</h3>
                <div className="grid grid-cols-1 gap-2">
                  <p><span className="text-muted-foreground">Data da nota fiscal:</span> {selectedRecord.dataNF}</p>
                  <p><span className="text-muted-foreground">Hora:</span> {selectedRecord.horaNF ?? "—"}</p>
                  <p><span className="text-muted-foreground">Produto:</span> {selectedRecord.produto}</p>
                  <p><span className="text-muted-foreground">Placa:</span> {selectedRecord.placa}</p>
                  <p><span className="text-muted-foreground">Observação da NF:</span> {selectedRecord.observacaoNF}</p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Conferência</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <StatusBadge status={selectedRecord.status} variant="solid" />
                  </div>
                  <p><span className="text-muted-foreground">Motivo:</span> {selectedRecord.motivo}</p>
                  {/* Destaque visual simples para divergência, mantendo regra apenas em nível de exibição mock. */}
                  <div className={`rounded-md border p-3 ${hasDivergence ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
                    <p><span className="text-muted-foreground">Base:</span> {selectedRecord.comparacaoBase}</p>
                    <p><span className="text-muted-foreground">Complementar:</span> {selectedRecord.comparacaoComplementar}</p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
