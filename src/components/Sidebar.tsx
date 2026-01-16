import { useState } from "react";
import { 
  LayoutDashboard, 
  Code2, 
  Camera, 
  Play, 
  Settings, 
  User,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard }, // Rótulo menor para mobile
  { id: "code", label: "Code", icon: Code2 },
  { id: "vision", label: "Vision", icon: Camera },
  { id: "motion", label: "Motion", icon: Play },
];

export function Sidebar({ activeMode, onModeChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed z-50 bg-sidebar border-kojak-border transition-all duration-300",
        // Mobile: Barra inferior | Desktop: Barra lateral esquerda
        "bottom-0 left-0 w-full h-16 flex flex-row border-t md:top-0 md:h-screen md:w-64 md:flex-col md:border-r",
        collapsed && "md:w-16"
      )}
    >
      {/* Logo - Escondido no Mobile para ganhar espaço */}
      <div className="hidden md:flex items-center gap-3 px-4 py-6 border-b border-kojak-border">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-purple">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground">Kojak AI</span>
          </div>
        )}
      </div>

      {/* Navegação - Horizontal no mobile, Vertical no PC */}
      <nav className="flex-1 flex flex-row md:flex-col items-center justify-around md:justify-start px-2 md:px-3 py-2 md:py-4 md:space-y-1">
        {navItems.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={cn(
                "flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2 md:py-3 rounded-lg transition-all",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                "md:w-full"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className={cn("text-[10px] md:text-sm font-medium", collapsed && "md:hidden")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Botão de Recolher - Apenas Desktop */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute -right-3 top-20 w-6 h-6 items-center justify-center rounded-full bg-kojak-surface border border-kojak-border"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
