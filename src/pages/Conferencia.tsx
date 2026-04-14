import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { conferenciaRecords, StatusType } from "@/data/mock";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";

const statusFilters: (StatusType | "todos")[] = ["todos", "vinculado", "aguardando", "divergente", "ambiguo"];

export default function Conferencia() {
  const [activeFilter, setActiveFilter] = useState<StatusType | "todos">("todos");
  const [search, setSearch] = useState("");

  const filtered = conferenciaRecords.filter((r) => {
    if (activeFilter !== "todos" && r.status !== activeFilter) return false;
    if (search && !r.contrato.toLowerCase().includes(search.toLowerCase()) && !r.nota.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
                <TableHead>Placa</TableHead>
                {/* Nomenclaturas padronizadas para aderência ao contexto real do projeto. */}
                <TableHead className="text-right">Peso Fiscal</TableHead>
                <TableHead className="text-right">Peso Líquido</TableHead>
                <TableHead className="text-right">Valor (R$)</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.chaveDeterministica}</TableCell>
                  <TableCell className="font-medium">{r.contrato}</TableCell>
                  <TableCell>{r.nota}</TableCell>
                  <TableCell>{r.placa}</TableCell>
                  <TableCell className="text-right">{r.pesoBase.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{r.pesoComplementar?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.origem}</Badge></TableCell>
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
    </div>
  );
}
