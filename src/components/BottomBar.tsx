import { Code2, Camera, Play, MessageCircle, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomBarProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
  onOpenHistory: () => void;
}

const modes = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "code", label: "Code", icon: Code2 },
  { id: "vision", label: "Vision", icon: Camera },
  { id: "motion", label: "Motion", icon: Play },
];

export function BottomBar({ activeMode, onModeChange, onOpenHistory }: BottomBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent backdrop-blur-xl" />
      
      {/* Content */}
      <div className="relative flex items-center justify-around px-2 py-3 safe-area-inset-bottom">
        {/* History Button */}
        <button
          onClick={onOpenHistory}
          className="flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">Histórico</span>
        </button>

        {/* Mode buttons */}
        {modes.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 transition-all",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary animate-pulse" />
              )}
              <mode.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_hsl(270,91%,65%)]")} />
              <span className="text-[10px] font-medium">{mode.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
