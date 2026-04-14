import { cn } from "@/lib/utils";
import { StatusType, statusLabels } from "@/data/mock";

const statusStyles: Record<StatusType, string> = {
  vinculado: "bg-[hsl(var(--status-vinculado)/0.15)] text-[hsl(var(--status-vinculado))] border-[hsl(var(--status-vinculado)/0.3)]",
  aguardando: "bg-[hsl(var(--status-aguardando)/0.15)] text-[hsl(var(--status-aguardando))] border-[hsl(var(--status-aguardando)/0.3)]",
  divergente: "bg-[hsl(var(--status-divergente)/0.15)] text-[hsl(var(--status-divergente))] border-[hsl(var(--status-divergente)/0.3)]",
  ambiguo: "bg-[hsl(var(--status-ambiguo)/0.15)] text-[hsl(var(--status-ambiguo))] border-[hsl(var(--status-ambiguo)/0.3)]",
};

const statusSolidStyles: Record<StatusType, string> = {
  vinculado: "bg-[hsl(var(--status-vinculado))] text-white border-[hsl(var(--status-vinculado))]",
  aguardando: "bg-[#C78600] text-white border-[#C78600]",
  divergente: "bg-[hsl(var(--status-divergente))] text-white border-[hsl(var(--status-divergente))]",
  ambiguo: "bg-[hsl(var(--status-ambiguo))] text-white border-[hsl(var(--status-ambiguo))]",
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  variant?: "default" | "solid";
}

export function StatusBadge({ status, className, variant = "default" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        // Mantém o estilo atual por padrão e permite versão de alto contraste onde for necessário.
        variant === "solid" ? statusSolidStyles[status] : statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
