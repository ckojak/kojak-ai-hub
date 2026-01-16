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
  { id: "dashboard", label: "Painel Geral", icon: LayoutDashboard },
  { id: "code", label: "Kojak Code", icon: Code2, description: "Criação de código" },
  { id: "vision", label: "Kojak Vision", icon: Camera, description: "Criação de imagens" },
  { id: "motion", label: "Kojak Motion", icon: Play, description: "Criação de vídeos" },
];

const bottomItems = [
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "profile", label: "Perfil do Usuário", icon: User },
];

export function Sidebar({ activeMode, onModeChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col border-r border-kojak-border bg-sidebar transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-kojak-border">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-purple glow-purple">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col animate-fade-in">
            <span className="text-lg font-semibold text-foreground">Kojak AI</span>
            <span className="text-xs text-kojak-text-secondary">Inteligência Multimodal</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-kojak-purple/15 text-primary border-glow"
                  : "text-muted-foreground hover:bg-kojak-surface hover:text-foreground"
              )}
            >
              <item.icon 
                className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} 
              />
              {!collapsed && (
                <div className="flex flex-col items-start animate-fade-in">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-kojak-text-secondary">{item.description}</span>
                  )}
                </div>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Items */}
      <div className="px-3 py-4 space-y-1 border-t border-kojak-border">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:bg-kojak-surface hover:text-foreground transition-all duration-200 group"
          >
            <item.icon className="w-5 h-5 flex-shrink-0 group-hover:text-foreground transition-colors" />
            {!collapsed && (
              <span className="text-sm font-medium animate-fade-in">{item.label}</span>
            )}
          </button>
        ))}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 flex items-center justify-center rounded-full bg-kojak-surface border border-kojak-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-200"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
