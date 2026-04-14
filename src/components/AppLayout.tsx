import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 flex items-center justify-between px-4 border-b bg-[hsl(var(--header-bg))] text-[hsl(var(--header-foreground))]">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-[hsl(var(--header-foreground))] hover:bg-white/10" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide">SICON</span>
                <span className="text-xs opacity-70">|</span>
                <span className="text-xs opacity-70 uppercase tracking-widest">Contabilidade</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-white/30 text-[hsl(var(--header-foreground))] text-xs">
                Base GRL053
              </Badge>
              <div className="flex items-center gap-2 text-xs">
                <User className="h-4 w-4 opacity-70" />
                <span className="hidden sm:inline opacity-90">Analista Fiscal</span>
              </div>
            </div>
          </header>
          {/* Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
