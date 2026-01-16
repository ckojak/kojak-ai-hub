import { useState } from "react";
import { Send, Code2, Camera, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, mode: string) => void;
  isLoading?: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
}

const modes = [
  { id: "code", label: "Code", icon: Code2, color: "text-blue-400" },
  { id: "vision", label: "Vision", icon: Camera, color: "text-green-400" },
  { id: "motion", label: "Motion", icon: Play, color: "text-orange-400" },
];

export function ChatInput({ onSend, isLoading, activeMode, onModeChange }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSend(message.trim(), activeMode);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const currentMode = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <div className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto bg-kojak-surface border border-kojak-border rounded-2xl shadow-lg glow-purple transition-all duration-300 hover:border-primary/30"
      >
        {/* Mode Selector */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-kojak-border/50">
          <span className="text-xs text-kojak-text-secondary mr-2">Modo:</span>
          {modes.map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onModeChange(mode.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-kojak-charcoal hover:text-foreground"
                )}
              >
                <mode.icon className={cn("w-3.5 h-3.5", isActive && mode.color)} />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="flex items-end gap-3 p-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Digite sua mensagem para ${currentMode.label}...`}
            className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-kojak-text-secondary resize-none focus:outline-none text-sm leading-relaxed"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
              message.trim() && !isLoading
                ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-105"
                : "bg-kojak-charcoal text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Hint */}
      <p className="text-center text-xs text-kojak-text-secondary mt-3">
        Pressione <kbd className="px-1.5 py-0.5 rounded bg-kojak-surface border border-kojak-border text-foreground">Enter</kbd> para enviar
      </p>
    </div>
  );
}
