import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusType } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Loader2, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const statusFilters: (StatusType | "todos")[] = ["todos", "vinculado", "aguardando", "divergente", "ambiguo"];
const statusFilterLabels: Record<StatusType | "todos", string> = {
  todos: "Todos",
  vinculado: "Vinculado",
  aguardando: "Aguardando",
  divergente: "Divergente",
  ambiguo: "Ambíguo",
};

const pageSizeOptions = [25, 50, 100] as const;

type LinhaConferencia = {
  id: string;
  chave: string;
  contrato: string;
  nota: string;
  status: StatusType;
  motivoStatus: string | null;
  origem: string | null;
  placa: string | null;
  dataReferencia: string | null;
  updatedAt: string | null;
};

type ContagemStatus = Record<StatusType | "todos", number>;

function validarStatus(status: string, chave: string): StatusType {
  // Status da conferência é materializado no backend; UI não pode inferir nem corrigir semanticamente.
  if (status === "vinculado" || status === "aguardando" || status === "divergente" || status === "ambiguo") return status;
  throw new Error(`Status inválido na conferência para a chave ${chave}: "${status}"`);
}

function formatarDataHora(valor: string | null): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR");
}

function formatarMotivoStatus(motivoStatus: string | null): string {
  if (!motivoStatus) return "—";
  const mapa: Record<string, string> = {
    vinculo_confirmado: "Vínculo confirmado",
    sem_complementar: "Sem complementar",
    sem_diagnostico_elegivel: "Sem diagnóstico elegível",
    contrato_diferente: "Contrato diferente",
    multiplas_correspondencias: "Múltiplas correspondências",
  };
  return mapa[motivoStatus] ?? motivoStatus;
}

export default function Conferencia() {
  const [activeFilter, setActiveFilter] = useState<StatusType | "todos">("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [records, setRecords] = useState<LinhaConferencia[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [contagens, setContagens] = useState<ContagemStatus>({
    todos: 0,
    vinculado: 0,
    aguardando: 0,
    divergente: 0,
    ambiguo: 0,
  });
  const [selecionada, setSelecionada] = useState<LinhaConferencia | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  const carregarConferencia = async () => {
    setLoading(true);
    setErro(null);

    try {
      const statusSelecionado = activeFilter === "todos" ? null : activeFilter;
      const inicio = (page - 1) * pageSize;
      const fim = inicio + pageSize - 1;

      // A tela consome um único dataset vindo da conferência materializada (via view backend), conforme PRD.
      // Não existe join no frontend para evitar decisão semântica fora da camada de processamento.
      let query = supabase
        .from("vw_conferencia_tela" as never)
        .select("id, chave_normalizada, contrato_vinculado, nota_fiscal, status, motivo_status, origem, placa, data_referencia, updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(inicio, fim);

      if (statusSelecionado) query = query.eq("status", statusSelecionado);
      if (search.trim()) {
        query = query.or(`contrato_vinculado.ilike.%${search.trim()}%,nota_fiscal.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw new Error(`Erro ao carregar conferência: ${error.message}`);

      const linhas: LinhaConferencia[] = (data ?? []).map((row: any) => ({
        id: row.id,
        chave: row.chave_normalizada,
        contrato: row.contrato_vinculado,
        nota: row.nota_fiscal,
        status: validarStatus(row.status, row.chave_normalizada),
        motivoStatus: row.motivo_status ?? null,
        origem: row.origem,
        placa: row.placa ?? null,
        dataReferencia: row.data_referencia ?? null,
        updatedAt: row.updated_at ?? null,
      }));

      setRecords(linhas);
      setTotalRows(count ?? 0);

      // KPIs e badges usam o mesmo universo da listagem (busca aplicada; status separado por grupo).
      const filtrosBusca = search.trim();
      const contagensParciais: ContagemStatus = {
        todos: 0,
        vinculado: 0,
        aguardando: 0,
        divergente: 0,
        ambiguo: 0,
      };

      const baseCountQuery = async (status?: StatusType) => {
        let cQuery = supabase
          .from("vw_conferencia_tela" as never)
          .select("id", { count: "exact", head: true });

        if (status) cQuery = cQuery.eq("status", status);
        if (filtrosBusca) cQuery = cQuery.or(`contrato_vinculado.ilike.%${filtrosBusca}%,nota_fiscal.ilike.%${filtrosBusca}%`);

        const { count: c, error: e } = await cQuery;
        if (e) throw new Error(`Erro ao contar conferência${status ? ` (${status})` : ""}: ${e.message}`);
        return c ?? 0;
      };

      const [todos, vinculado, aguardando, divergente, ambiguo] = await Promise.all([
        baseCountQuery(),
        baseCountQuery("vinculado"),
        baseCountQuery("aguardando"),
        baseCountQuery("divergente"),
        baseCountQuery("ambiguo"),
      ]);

      contagensParciais.todos = todos;
      contagensParciais.vinculado = vinculado;
      contagensParciais.aguardando = aguardando;
      contagensParciais.divergente = divergente;
      contagensParciais.ambiguo = ambiguo;
      setContagens(contagensParciais);
    } catch (e) {
      console.error("Falha técnica na leitura da conferência", e);
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      setRecords([]);
      setTotalRows(0);
      setContagens({ todos: 0, vinculado: 0, aguardando: 0, divergente: 0, ambiguo: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarConferencia();
  }, [activeFilter, page, pageSize, search]);

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
  const exibindoDe = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const exibindoAte = Math.min(page * pageSize, totalRows);

  const abrirDrawer = (linha: LinhaConferencia) => {
    setSelecionada(linha);
    setDrawerAberto(true);
  };

  return (
    <div>
      <PageHeader title="Módulo de Conferência" subtitle="Visualização do resultado consolidado entre Base GRL053 e conferência materializada">
        {/* Botão Atualizar apenas refaz leitura do estado consolidado.
            Não executa reprocessamento conforme PRD. */}
        <Button variant="outline" size="sm" onClick={carregarConferencia} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
          Atualizar
        </Button>
        <Button variant="outline" size="sm" disabled><Download className="h-4 w-4 mr-1" /> Exportar</Button>
      </PageHeader>

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-xs text-muted-foreground">
          Tela conectada ao estado consolidado do banco. O status é lido da tabela `conferencia` e exibido sem inferência no frontend.
        </CardContent>
      </Card>

      {/* KPIs compactos para leitura imediata da distribuição operacional. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold">{contagens.todos}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Vinculados</p><p className="text-xl font-semibold">{contagens.vinculado}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Aguardando</p><p className="text-xl font-semibold">{contagens.aguardando}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Divergentes</p><p className="text-xl font-semibold">{contagens.divergente}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Ambíguos</p><p className="text-xl font-semibold">{contagens.ambiguo}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contrato ou nota..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              // Busca reinicia a paginação para manter contagens e recorte sincronizados.
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map((s) => (
            <Button
              key={s}
              variant={activeFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveFilter(s);
                setPage(1);
              }}
              className="text-xs"
            >
              {statusFilterLabels[s]} ({contagens[s]})
            </Button>
          ))}
        </div>
        <div className="w-[120px]">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Por página" />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>{opt}/pág</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">
            Exibindo {exibindoDe}–{exibindoAte} de {totalRows}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Motivo do status</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Atualizado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando registros...</span>
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => abrirDrawer(r)}>
                  <TableCell><StatusBadge status={r.status} variant="solid" /></TableCell>
                  <TableCell>{formatarMotivoStatus(r.motivoStatus)}</TableCell>
                  <TableCell className="font-medium">{r.contrato}</TableCell>
                  <TableCell>{r.nota}</TableCell>
                  <TableCell>{r.origem ?? "—"}</TableCell>
                  <TableCell>{r.placa ?? "—"}</TableCell>
                  <TableCell>{r.dataReferencia ?? "—"}</TableCell>
                  <TableCell>{formatarDataHora(r.updatedAt)}</TableCell>
                </TableRow>
              ))}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPaginas}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={page >= totalPaginas || loading}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Drawer open={drawerAberto} onOpenChange={setDrawerAberto}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Detalhe da conferência</DrawerTitle>
            <DrawerDescription>
              Visualização somente leitura para investigação operacional.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 grid gap-4">
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Dados base</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Status:</span> {selecionada ? <StatusBadge status={selecionada.status} className="ml-2" /> : "—"}</p>
                <p><span className="text-muted-foreground">Motivo:</span> {selecionada ? formatarMotivoStatus(selecionada.motivoStatus) : "—"}</p>
                <p><span className="text-muted-foreground">Contrato:</span> {selecionada?.contrato ?? "—"}</p>
                <p><span className="text-muted-foreground">Nota:</span> {selecionada?.nota ?? "—"}</p>
                <p><span className="text-muted-foreground">Placa:</span> {selecionada?.placa ?? "—"}</p>
                <p><span className="text-muted-foreground">Data:</span> {selecionada?.dataReferencia ?? "—"}</p>
                <p><span className="text-muted-foreground">Chave técnica:</span> <span className="font-mono text-xs">{selecionada?.chave ?? "—"}</span></p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Dados complementar</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Origem:</span> {selecionada?.origem ?? "—"}</p>
                <p className="text-muted-foreground">Demais campos complementares não estão disponíveis na view atual.</p>
              </CardContent>
            </Card>
          </div>

          <DrawerFooter>
            <Button variant="outline" onClick={() => setDrawerAberto(false)}>Fechar</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
