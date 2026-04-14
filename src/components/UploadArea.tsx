import { Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UploadAreaProps {
  title: string;
  subtitle?: string;
  onUpload?: () => void;
}

export function UploadArea({ title, subtitle, onUpload }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); onUpload?.(); }}
      onClick={onUpload}
    >
      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      <p className="text-xs text-muted-foreground mt-3">
        Arraste o arquivo ou clique para selecionar
      </p>
    </div>
  );
}
