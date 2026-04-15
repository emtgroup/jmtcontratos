import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { dashboardStats, conferenciaRecords, chartData, layoutsComplementares } from "@/data/mock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle, Clock, AlertTriangle, HelpCircle, Database } from "lucide-react";

const statCards = [
  { label: "Total Registros", value: dashboardStats.total, icon: Database, borderColor: "border-l-primary" },
  { label: "Vinculados", value: dashboardStats.vinculados, icon: CheckCircle, borderColor: "border-l-[hsl(var(--status-vinculado))]" },
  { label: "Aguardando", value: dashboardStats.aguardando, icon: Clock, borderColor: "border-l-[hsl(var(--status-aguardando))]" },
  // Terminologia alinhada ao PRD da conferência para manter consistência entre telas.
  { label: "Contrato Divergente", value: dashboardStats.divergentes, icon: AlertTriangle, borderColor: "border-l-[hsl(var(--status-divergente))]" },
  { label: "Ambíguos", value: dashboardStats.ambiguos, icon: HelpCircle, borderColor: "border-l-[hsl(var(--status-ambiguo))]" },
];

export default function Dashboard() {
  return (
    <div>
      <PageHeader title="Visão Geral" subtitle="Painel consolidado dos resultados exibidos no módulo de conferência (mock)" />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Prévia dos Registros da Conferência</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead>Placa</TableHead>
                  {/* Label padronizado para o vocabulário oficial do projeto. */}
                  <TableHead className="text-right">Peso Fiscal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conferenciaRecords.map((r) => (
                  <TableRow key={r.id}>
                    {/* Reaproveita o mesmo padrão visual oficial da Conferência para manter consistência de badges. */}
                    <TableCell><StatusBadge status={r.status} variant="solid" /></TableCell>
                    <TableCell className="font-medium">{r.contrato}</TableCell>
                    <TableCell>{r.nota}</TableCell>
                    <TableCell>{r.placa}</TableCell>
                    <TableCell className="text-right">{r.pesoBase.toLocaleString("pt-BR")} kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Chart + Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-muted-foreground">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base ativa</span>
                <span className="font-medium">GRL053</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Última importação</span>
                <span className="font-medium">14/04/2026</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Layouts complementares</span>
                {/* Indicador sincronizado com os mocks atuais de configuração/layout. */}
                <span className="font-medium">{layoutsComplementares.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
