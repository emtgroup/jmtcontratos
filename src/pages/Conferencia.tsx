import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusType } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Loader2, RefreshCcw } from "lucide-react";

const statusFilters: (StatusType | "todos")[] = ["todos", "vinculado", "aguardando", "divergente", "ambiguo"];
const statusFilterLabels: Record<StatusType | "todos", string> = {
  todos: "Todos",
  vinculado: "Vinculado",
  aguardando: "Aguardando",
  divergente: "Contrato Divergente",
  ambiguo: "Ambíguo",
};

type LinhaConferencia = {
  id: string;
  chave: string;
  contrato: string;
  nota: string;
  status: StatusType;
  origem: string | null;
};

function normalizarStatus(status: string | null | undefined): StatusType {
  if (status === "vinculado" || status === "divergente" || status === "ambiguo") return status;
  return "aguardando";
}

export default function Conferencia() {
  const [activeFilter, setActiveFilter] = useState<StatusType | "todos">("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [records, setRecords] = useState<LinhaConferencia[]>([]);

  const carregarConferencia = async () => {
    setLoading(true);
    setErro(null);

    try {
      // A conferência deve refletir o estado consolidado do sistema; por isso consultamos base + conferência sem usar mock.
      const { data: baseRows, error: baseError } = await supabase
        .from("registros_base")
        .select("id, chave_normalizada, contrato_vinculado, nota_fiscal")
        .order("updated_at", { ascending: false })
        .limit(2000);

      if (baseError) throw new Error(`Erro ao carregar base: ${baseError.message}`);

      const chaves = (baseRows ?? []).map((row) => row.chave_normalizada);
      const statusMap = new Map<string, { status: StatusType; origem: string | null }>();

      if (chaves.length > 0) {
        const { data: confRows, error: confError } = await supabase
          .from("conferencia")
          .select("chave_normalizada, status, origem")
          .in("chave_normalizada", chaves);

        if (confError) throw new Error(`Erro ao carregar conferência: ${confError.message}`);

        for (const row of confRows ?? []) {
          statusMap.set(row.chave_normalizada, {
            status: normalizarStatus(row.status),
            origem: row.origem,
          });
        }
      }

      const linhas: LinhaConferencia[] = (baseRows ?? []).map((row) => {
        const statusInfo = statusMap.get(row.chave_normalizada);
        return {
          id: row.id,
          chave: row.chave_normalizada,
          contrato: row.contrato_vinculado,
          nota: row.nota_fiscal,
          status: statusInfo?.status ?? "aguardando",
          origem: statusInfo?.origem ?? null,
        };
      });

      setRecords(linhas);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarConferencia();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (activeFilter !== "todos" && r.status !== activeFilter) return false;
      if (search && !r.contrato.toLowerCase().includes(search.toLowerCase()) && !r.nota.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, activeFilter, search]);

  return (
    <div>
      <PageHeader title="Módulo de Conferência" subtitle="Visualização do resultado consolidado entre Base GRL053 e conferência materializada">
        <Button variant="outline" size="sm" onClick={carregarConferencia} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
          Atualizar
        </Button>
        <Button variant="outline" size="sm" disabled><Download className="h-4 w-4 mr-1" /> Exportar</Button>
      </PageHeader>

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-xs text-muted-foreground">
          Tela conectada ao estado consolidado do banco. O status é lido da tabela `conferencia` e exibido por chave da base.
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contrato ou nota..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((s) => (
            <Button key={s} variant={activeFilter === s ? "default" : "outline"} size="sm" onClick={() => setActiveFilter(s)} className="capitalize text-xs">
              {statusFilterLabels[s]}
            </Button>
          ))}
        </div>
      </div>

      {erro && (
        <Card className="mb-4 border-l-4 border-l-[hsl(var(--status-divergente))]">
          <CardContent className="py-3 text-xs text-[hsl(var(--status-divergente))] font-mono">
            Falha ao carregar conferência: {erro}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-muted-foreground">Chave técnica</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando registros...</span>
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge status={r.status} variant="solid" /></TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{r.chave}</TableCell>
                  <TableCell className="font-medium">{r.contrato}</TableCell>
                  <TableCell>{r.nota}</TableCell>
                  <TableCell>{r.origem ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
