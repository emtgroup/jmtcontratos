import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusType } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Loader2, RefreshCcw, ChevronLeft, ChevronRight, Copy, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fetchLayoutBase } from "@/services/layoutBaseService";
import { toast } from "sonner";

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
  contratoVinculado: string;
  contratoInterno: string | null;
  nota: string;
  clifor: string | null;
  nomeCooperativa: string | null;
  status: StatusType;
  motivoStatus: string | null;
  origem: string | null;
  placa: string | null;
  dataBase: string | null;
  updatedAt: string | null;
};
type CampoDrawerBase = { id: string; label: string; valor: string; tipoColunaNormalizado: string };

type ContagemStatus = Record<StatusType | "todos", number>;
type LinhaConferenciaRaw = {
  id: string;
  chave_normalizada: string;
  contrato_vinculado: string;
  contrato_interno: string | null;
  nota_fiscal: string;
  clifor: string | null;
  nome_cooperativa: string | null;
  status: string;
  motivo_status: string | null;
  origem: string | null;
  placa: string | null;
  data_referencia: string | null;
  updated_at: string | null;
};
type TipoColunaLabel = "contrato_vinculado" | "contrato_interno" | "nota_fiscal" | "clifor" | "placa" | "data_da_nota";
type LabelsConferencia = Record<TipoColunaLabel, string>;

const labelsPadrao: LabelsConferencia = {
  contrato_vinculado: "Contrato vinculado",
  contrato_interno: "Contrato interno",
  nota_fiscal: "Nota fiscal",
  clifor: "Clifor",
  placa: "Placa",
  data_da_nota: "Data da base",
};

function normalizaTipoColuna(tipoColuna: string): string {
  return tipoColuna.trim().toLowerCase().replace(/\s+/g, "_");
}

function construirLabelsComApelido(colunas: Array<{ tipo_coluna: string; apelido: string }>): LabelsConferencia {
  const aliasesPorTipo = new Map<string, string>();
  for (const coluna of colunas) {
    const tipo = normalizaTipoColuna(coluna.tipo_coluna);
    const apelido = coluna.apelido?.trim();
    // Hardening UX: evita rótulo fraco (curto, vazio ou só números) para não degradar a leitura operacional.
    const apelidoValido = Boolean(apelido) && apelido.length >= 3 && !/^\d+$/.test(apelido);
    if (apelidoValido) aliasesPorTipo.set(tipo, apelido);
  }

  // Apelido é puramente visual: fallback mantém nomenclatura padrão sem alterar semântica do backend.
  return {
    contrato_vinculado: aliasesPorTipo.get("contrato_vinculado") ?? labelsPadrao.contrato_vinculado,
    contrato_interno: aliasesPorTipo.get("contrato_interno") ?? labelsPadrao.contrato_interno,
    nota_fiscal: aliasesPorTipo.get("nota_fiscal") ?? labelsPadrao.nota_fiscal,
    clifor: aliasesPorTipo.get("clifor") ?? labelsPadrao.clifor,
    placa: aliasesPorTipo.get("placa") ?? labelsPadrao.placa,
    data_da_nota: aliasesPorTipo.get("data_da_nota") ?? aliasesPorTipo.get("data") ?? labelsPadrao.data_da_nota,
  };
}

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

function formatarDataEmissao(valor: string | null): string {
  if (!valor) return "—";

  const valorNormalizado = valor.trim();
  if (!valorNormalizado) return "—";

  // Conversão visual de serial Excel (sistema 1900): mantém dado original intacto.
  const serialExcel = Number(valorNormalizado.replace(",", "."));
  if (Number.isFinite(serialExcel)) {
    const serialTruncado = Math.trunc(serialExcel);
    if (serialTruncado <= 0) return "—";

    const baseExcelUtc = Date.UTC(1899, 11, 30);
    const dataUtc = new Date(baseExcelUtc + serialTruncado * 24 * 60 * 60 * 1000);
    if (Number.isNaN(dataUtc.getTime())) return "—";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(dataUtc);
  }

  // Fallback visual: se já vier como data textual válida, padroniza para DD/MM/AAAA.
  const dataTexto = new Date(valorNormalizado);
  if (Number.isNaN(dataTexto.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dataTexto);
}

function formatarMotivoStatus(motivoStatus: string | null): string {
  // Regra da tela: exibir exatamente o que vier do backend (sem inferência no frontend).
  return motivoStatus ?? "—";
}

function sanitizarTextoFiltro(valor: string): string {
  // Sanitização mínima para manter filtros estáveis no PostgREST (.or/.ilike) com entrada livre de usuário.
  // Remove caracteres de controle sintático da expressão de filtro e normaliza espaços.
  return valor.replace(/[,\(\)"']/g, " ").replace(/\s+/g, " ").trim();
}

function escaparPadraoLike(valor: string): string {
  // Escape mínimo de curingas para busca literal em ILIKE.
  return valor.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export default function Conferencia() {
  const [activeFilter, setActiveFilter] = useState<StatusType | "todos">("todos");
  const [search, setSearch] = useState("");
  const [filtroNomeCooperativa, setFiltroNomeCooperativa] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroClifor, setFiltroClifor] = useState("");
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState("");
  const [filtroContratoVinculado, setFiltroContratoVinculado] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);
  const [opcoesCooperativa, setOpcoesCooperativa] = useState<string[]>([]);
  const [opcoesOrigem, setOpcoesOrigem] = useState<string[]>([]);
  const [opcoesFiltroParciais, setOpcoesFiltroParciais] = useState(false);
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
  const [labels, setLabels] = useState<LabelsConferencia>(labelsPadrao);
  const [avisoLayoutBase, setAvisoLayoutBase] = useState<string | null>(null);
  const [colunasBaseDrawer, setColunasBaseDrawer] = useState<Array<{ nome_coluna_excel: string; apelido: string; tipo_coluna: string; exibir_no_drawer?: boolean }>>([]);
  const [camposExtrasDrawer, setCamposExtrasDrawer] = useState<CampoDrawerBase[]>([]);
  const [loadingCamposExtrasDrawer, setLoadingCamposExtrasDrawer] = useState(false);

  const aplicarFiltrosServidor = (
    queryBase: any,
    statusSelecionado: StatusType | null,
    incluirStatus = true,
  ) => {
    let query = queryBase;
    const busca = escaparPadraoLike(sanitizarTextoFiltro(search));
    const nomeCooperativa = escaparPadraoLike(sanitizarTextoFiltro(filtroNomeCooperativa));
    const origem = escaparPadraoLike(sanitizarTextoFiltro(filtroOrigem));
    const clifor = escaparPadraoLike(sanitizarTextoFiltro(filtroClifor));
    const notaFiscal = escaparPadraoLike(sanitizarTextoFiltro(filtroNotaFiscal));
    const contratoVinculado = escaparPadraoLike(sanitizarTextoFiltro(filtroContratoVinculado));
    const placa = escaparPadraoLike(sanitizarTextoFiltro(filtroPlaca));

    if (incluirStatus && statusSelecionado) query = query.eq("status", statusSelecionado);
    if (busca) {
      query = query.or(`contrato_vinculado.ilike.%${busca}%,nota_fiscal.ilike.%${busca}%,clifor.ilike.%${busca}%,nome_cooperativa.ilike.%${busca}%`);
    }

    if (nomeCooperativa) query = query.ilike("nome_cooperativa", `%${nomeCooperativa}%`);
    if (origem) query = query.ilike("origem", `%${origem}%`);
    if (clifor) query = query.ilike("clifor", `%${clifor}%`);
    if (notaFiscal) query = query.ilike("nota_fiscal", `%${notaFiscal}%`);
    if (contratoVinculado) query = query.ilike("contrato_vinculado", `%${contratoVinculado}%`);
    if (placa) query = query.ilike("placa", `%${placa}%`);

    return query;
  };

  const carregarOpcoesFiltros = async () => {
    try {
      // Paginação leve para evitar corte silencioso de opções quando houver mais de 5000 registros.
      // Mantemos limite de segurança para não ampliar carga de forma descontrolada.
      const lotes: Array<{ nome_cooperativa?: string | null; origem?: string | null }> = [];
      const pageSize = 1000;
      const limiteSeguranca = 20000;
      let atingiuLimiteSeguranca = true;
      for (let inicio = 0; inicio < limiteSeguranca; inicio += pageSize) {
        const fim = inicio + pageSize - 1;
        const { data, error } = await supabase
          .from("vw_conferencia_tela" as never)
          .select("nome_cooperativa, origem")
          .range(inicio, fim);
        if (error) throw new Error(`Erro ao carregar opções de filtros: ${error.message}`);
        if (!data || data.length === 0) {
          atingiuLimiteSeguranca = false;
          break;
        }
        lotes.push(...data);
        if (data.length < pageSize) {
          atingiuLimiteSeguranca = false;
          break;
        }
      }

      const cooperativas = [...new Set((lotes || [])
        .map((row: { nome_cooperativa?: string | null }) => row.nome_cooperativa?.trim())
        .filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b));

      const origens = [...new Set((lotes || [])
        .map((row: { origem?: string | null }) => row.origem?.trim())
        .filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b));

      // Se o limite de segurança for atingido, evitamos Select parcial (que poderia ocultar opções)
      // e voltamos para input textual livre, mantendo a busca principal 100% server-side.
      setOpcoesFiltroParciais(atingiuLimiteSeguranca);
      setOpcoesCooperativa(cooperativas);
      setOpcoesOrigem(origens);
    } catch (e) {
      console.error("Falha ao carregar opções dos filtros da conferência", e);
      setOpcoesFiltroParciais(false);
      setOpcoesCooperativa([]);
      setOpcoesOrigem([]);
    }
  };

  const limparFiltros = () => {
    setSearch("");
    setActiveFilter("todos");
    setFiltroNomeCooperativa("");
    setFiltroOrigem("");
    setFiltroClifor("");
    setFiltroNotaFiscal("");
    setFiltroContratoVinculado("");
    setFiltroPlaca("");
    setPage(1);
  };

  // Mantém o drawer em modo leitura e adiciona apenas ação utilitária de cópia para uso externo.
  const copiarChaveAcesso = async (valor: string) => {
    if (!valor || valor === "—") return;
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Chave copiada");
    } catch (error) {
      console.error("Falha ao copiar chave de acesso", error);
      toast.error("Não foi possível copiar a chave");
    }
  };

  const carregarLabelsLayoutBase = async () => {
    try {
      const { count: ativos, error: ativosError } = await supabase
        .from("layouts_base")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);
      if (ativosError) throw new Error(`Erro ao validar layout base ativo: ${ativosError.message}`);

      if ((ativos ?? 0) > 1) {
        // Segurança operacional: a tela segue com fallback visual e alerta inconsistência de configuração.
        setAvisoLayoutBase("Foram encontrados múltiplos layouts base ativos. Revise /configuracoes para manter apenas 1 ativo.");
      } else {
        setAvisoLayoutBase(null);
      }

      const layout = await fetchLayoutBase();
      if (!layout) {
        setLabels(labelsPadrao);
        setColunasBaseDrawer([]);
        return;
      }
      // Hardening: garante fallback booleano explícito para evitar inconsistência em bases legadas.
      setColunasBaseDrawer(layout.colunas.map((coluna) => ({ ...coluna, exibir_no_drawer: !!coluna.exibir_no_drawer })));
      setLabels(construirLabelsComApelido(layout.colunas));
    } catch (e) {
      console.error("Falha ao carregar apelidos do layout base para conferência", e);
      setLabels(labelsPadrao);
      setColunasBaseDrawer([]);
      setAvisoLayoutBase("Não foi possível validar os apelidos do layout base. A tela está usando rótulos padrão.");
    }
  };

  const carregarCamposExtrasDrawer = async (linha: LinhaConferencia) => {
    // Extração dinâmica limitada ao drawer: usa apenas configuração do layout base + dados_originais da Base.
    // Não altera semântica de status/matching, apenas enriquece contexto de leitura.
    setLoadingCamposExtrasDrawer(true);
    setCamposExtrasDrawer([]);
    try {
      const colunasMarcadas = colunasBaseDrawer.filter((col) => col.exibir_no_drawer);
      if (colunasMarcadas.length === 0) {
        setCamposExtrasDrawer([]);
        return;
      }

      const { data, error } = await supabase
        .from("registros_base")
        .select("dados_originais")
        .eq("chave_normalizada", linha.chave)
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`Erro ao carregar dados originais da base: ${error.message}`);

      // Hardening: evita quebra caso dados_originais venha em formato inesperado.
      const dadosBrutos = data?.dados_originais;
      const dadosOriginais = (dadosBrutos && typeof dadosBrutos === "object" && !Array.isArray(dadosBrutos)
        ? dadosBrutos
        : {}) as Record<string, unknown>;
      const tiposFixosDrawer = new Set([
        "contrato_vinculado",
        "contrato_interno",
        "nota_fiscal",
        "clifor",
        "placa",
        "data_da_nota",
        "data",
      ]);

      const extras = colunasMarcadas
        .filter((coluna) => !tiposFixosDrawer.has(normalizaTipoColuna(coluna.tipo_coluna)))
        .map((coluna) => {
          const valor = dadosOriginais[coluna.nome_coluna_excel];
          // Regra do drawer: campo marcado sempre aparece; quando vazio/ausente, exibe "—".
          const valorTextoBruto = valor == null ? "" : String(valor).trim();
          return {
            id: `${coluna.nome_coluna_excel}-${normalizaTipoColuna(coluna.tipo_coluna)}`,
            label: coluna.apelido?.trim() || coluna.nome_coluna_excel,
            valor: valorTextoBruto || "—",
            tipoColunaNormalizado: normalizaTipoColuna(coluna.tipo_coluna),
          };
        });

      setCamposExtrasDrawer(extras);
    } catch (e) {
      console.error("Falha ao carregar campos extras do drawer", e);
      setCamposExtrasDrawer([]);
    } finally {
      setLoadingCamposExtrasDrawer(false);
    }
  };

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
        .select("id, chave_normalizada, contrato_vinculado, contrato_interno, nota_fiscal, clifor, nome_cooperativa, status, motivo_status, origem, placa, data_referencia, updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(inicio, fim);

      query = aplicarFiltrosServidor(query, statusSelecionado, true);

      const { data, error, count } = await query;
      if (error) throw new Error(`Erro ao carregar conferência: ${error.message}`);

      const linhas: LinhaConferencia[] = ((data ?? []) as LinhaConferenciaRaw[]).map((row) => ({
        id: row.id,
        chave: row.chave_normalizada,
        contratoVinculado: row.contrato_vinculado,
        contratoInterno: row.contrato_interno ?? null,
        nota: row.nota_fiscal,
        clifor: row.clifor ?? null,
        nomeCooperativa: row.nome_cooperativa ?? null,
        status: validarStatus(row.status, row.chave_normalizada),
        motivoStatus: row.motivo_status ?? null,
        origem: row.origem,
        placa: row.placa ?? null,
        // Data principal da tela vem da Base (campo materializado no backend), não do complementar.
        dataBase: row.data_referencia ?? null,
        updatedAt: row.updated_at ?? null,
      }));

      setRecords(linhas);
      setTotalRows(count ?? 0);

      // KPIs e badges usam o mesmo universo da listagem (busca aplicada; status separado por grupo).
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

        cQuery = aplicarFiltrosServidor(cQuery, status ?? null, Boolean(status));

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
    void carregarLabelsLayoutBase();
    void carregarOpcoesFiltros();
  }, []);

  useEffect(() => {
    void carregarConferencia();
  }, [
    activeFilter,
    page,
    pageSize,
    search,
    filtroNomeCooperativa,
    filtroOrigem,
    filtroClifor,
    filtroNotaFiscal,
    filtroContratoVinculado,
    filtroPlaca,
  ]);

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
  const exibindoDe = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const exibindoAte = Math.min(page * pageSize, totalRows);

  const abrirDrawer = (linha: LinhaConferencia) => {
    setSelecionada(linha);
    void carregarCamposExtrasDrawer(linha);
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

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contrato, nota ou clifor..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              // Busca reinicia a paginação para manter contagens e recorte sincronizados.
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-[220px]">
          {opcoesCooperativa.length > 0 && !opcoesFiltroParciais ? (
            <Select
              value={filtroNomeCooperativa || "__todas__"}
              onValueChange={(value) => {
                setFiltroNomeCooperativa(value === "__todas__" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Nome cooperativa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas cooperativas</SelectItem>
                {opcoesCooperativa.map((cooperativa) => (
                  <SelectItem key={cooperativa} value={cooperativa}>
                    {cooperativa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Nome cooperativa..."
              value={filtroNomeCooperativa}
              onChange={(e) => {
                setFiltroNomeCooperativa(e.target.value);
                setPage(1);
              }}
            />
          )}
        </div>
        <div className="w-[220px]">
          {opcoesOrigem.length > 0 && !opcoesFiltroParciais ? (
            <Select
              value={filtroOrigem || "__todas__"}
              onValueChange={(value) => {
                setFiltroOrigem(value === "__todas__" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas origens</SelectItem>
                {opcoesOrigem.map((origem) => (
                  <SelectItem key={origem} value={origem}>
                    {origem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Origem..."
              value={filtroOrigem}
              onChange={(e) => {
                setFiltroOrigem(e.target.value);
                setPage(1);
              }}
            />
          )}
        </div>
        {opcoesFiltroParciais && (
          <p className="text-xs text-muted-foreground">
            Lista parcial de opções detectada. Use busca textual para cooperativa/origem.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
          className="inline-flex items-center gap-1"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros avançados
        </Button>
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
      {filtrosAvancadosAbertos && (
        <Card className="mb-4 border-dashed">
          <CardContent className="py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Input
                placeholder="Clifor..."
                value={filtroClifor}
                onChange={(e) => {
                  setFiltroClifor(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                placeholder="Nota fiscal..."
                value={filtroNotaFiscal}
                onChange={(e) => {
                  setFiltroNotaFiscal(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                placeholder="Contrato vinculado..."
                value={filtroContratoVinculado}
                onChange={(e) => {
                  setFiltroContratoVinculado(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                placeholder="Placa..."
                value={filtroPlaca}
                onChange={(e) => {
                  setFiltroPlaca(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex justify-end pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {erro && (
        <Card className="mb-4 border-l-4 border-l-[hsl(var(--status-divergente))]">
          <CardContent className="py-3 text-xs text-[hsl(var(--status-divergente))] font-mono">
            Falha ao carregar conferência: {erro}
          </CardContent>
        </Card>
      )}
      {avisoLayoutBase && (
        <Card className="mb-4 border-l-4 border-l-[hsl(var(--status-aguardando))]">
          <CardContent className="py-3 text-xs text-[hsl(var(--status-aguardando))]">
            {avisoLayoutBase}
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
          <div className="overflow-x-auto">
            <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>{labels.contrato_vinculado}</TableHead>
                <TableHead>{labels.nota_fiscal}</TableHead>
                <TableHead>{labels.clifor}</TableHead>
                <TableHead>Nome cooperativa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>{labels.placa}</TableHead>
                <TableHead>{labels.data_da_nota}</TableHead>
                <TableHead>Atualizado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando registros...</span>
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => abrirDrawer(r)}>
                  <TableCell><StatusBadge status={r.status} variant="solid" /></TableCell>
                  {/* FUTURO:
                      Exibir indicador visual de motivo_status na grid (tooltip ou badge)
                      somente quando backend passar valores consistentes
                      NÃO implementar agora */}
                  <TableCell className="font-medium max-w-[180px] truncate" title={r.contratoVinculado}>{r.contratoVinculado}</TableCell>
                  <TableCell className="max-w-[130px] truncate" title={r.nota}>{r.nota}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.clifor ?? "—"}>{r.clifor ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.nomeCooperativa ?? "—"}>{r.nomeCooperativa ?? "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate" title={r.origem ?? "—"}>{r.origem ?? "—"}</TableCell>
                  <TableCell>{r.placa ?? "—"}</TableCell>
                  <TableCell>{formatarDataEmissao(r.dataBase)}</TableCell>
                  <TableCell>{formatarDataHora(r.updatedAt)}</TableCell>
                </TableRow>
              ))}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </div>

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
                <p><span className="text-muted-foreground">Motivo do status:</span> {selecionada ? formatarMotivoStatus(selecionada.motivoStatus) : "—"}</p>
                {/* Separação explícita para reduzir ambiguidade operacional entre contrato vinculado e contrato interno. */}
                <p><span className="text-muted-foreground">{labels.contrato_vinculado}:</span> {selecionada?.contratoVinculado ?? "—"}</p>
                <p><span className="text-muted-foreground">{labels.contrato_interno}:</span> {selecionada?.contratoInterno ?? "—"}</p>
                <p><span className="text-muted-foreground">{labels.nota_fiscal}:</span> {selecionada?.nota ?? "—"}</p>
                <p><span className="text-muted-foreground">{labels.clifor}:</span> {selecionada?.clifor ?? "—"}</p>
                <p><span className="text-muted-foreground">{labels.placa}:</span> {selecionada?.placa ?? "—"}</p>
                <p><span className="text-muted-foreground">{labels.data_da_nota}:</span> {formatarDataEmissao(selecionada?.dataBase ?? null)}</p>
                {loadingCamposExtrasDrawer && (
                  <p className="text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando campos adicionais...
                  </p>
                )}
                {!loadingCamposExtrasDrawer && camposExtrasDrawer.length > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-muted-foreground text-xs mb-1">Campos adicionais da Base</p>
                    {camposExtrasDrawer.map((campo) => (
                      campo.tipoColunaNormalizado === "chave_de_acesso" ? (
                        <div key={campo.id} className="flex items-start justify-between gap-2">
                          <p className="min-w-0">
                            <span className="text-muted-foreground">{campo.label}:</span>{" "}
                            <span className="break-all">{campo.valor}</span>
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => copiarChaveAcesso(campo.valor)}
                            aria-label="Copiar chave de acesso"
                            title="Copiar chave de acesso"
                            disabled={campo.valor === "—"}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p key={campo.id}>
                          <span className="text-muted-foreground">{campo.label}:</span> {campo.valor}
                        </p>
                      )
                    ))}
                  </div>
                )}
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
