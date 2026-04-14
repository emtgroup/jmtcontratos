import { cn } from "@/lib/utils";
import { StatusType, statusLabels } from "@/data/mock";

const statusStyles: Record<StatusType, string> = {
  vinculado: "bg-[hsl(var(--status-vinculado)/0.15)] text-[hsl(var(--status-vinculado))] border-[hsl(var(--status-vinculado)/0.3)]",
  aguardando: "bg-[hsl(var(--status-aguardando)/0.15)] text-[hsl(var(--status-aguardando))] border-[hsl(var(--status-aguardando)/0.3)]",
  divergente: "bg-[hsl(var(--status-divergente)/0.15)] text-[hsl(var(--status-divergente))] border-[hsl(var(--status-divergente)/0.3)]",
  ambiguo: "bg-[hsl(var(--status-ambiguo)/0.15)] text-[hsl(var(--status-ambiguo))] border-[hsl(var(--status-ambiguo)/0.3)]",
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
