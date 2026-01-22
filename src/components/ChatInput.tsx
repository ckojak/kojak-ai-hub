import { useState, useEffect } from "react";
import { Send, Code2, Camera, Play, MessageCircle, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, mode: string) => void;
  isLoading?: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;
}

const modes = [
  { id: "chat", label: "Chat", icon: MessageCircle, color: "text-emerald-400" },
  { id: "code", label: "Code", icon: Code2, color: "text-blue-400" },
  { id: "vision", label: "Vision", icon: Camera, color: "text-amber-400" },
  { id: "motion", label: "Motion", icon: Play, color: "text-rose-400" },
];

export function ChatInput({ 
  onSend, 
  isLoading, 
  activeMode, 
  onModeChange,
  voiceTranscript,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onStopSpeaking,
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  // Update message when voice transcript changes
  useEffect(() => {
    if (voiceTranscript) {
      setMessage(voiceTranscript);
    }
  }, [voiceTranscript]);

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

  const handleVoiceToggle = () => {
    if (isListening) {
      onStopListening?.();
    } else {
      onStartListening?.();
    }
  };

  const currentMode = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <div className="sticky bottom-0 p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto glass-card-strong rounded-2xl transition-all duration-300 hover:border-primary/30 neon-border"
      >
        {/* Mode Selector - Hidden on mobile (uses bottom bar) */}
        <div className="hidden md:flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/10">
          <span className="text-xs text-muted-foreground mr-2">Modo:</span>
          {modes.map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onModeChange(mode.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/30 glow-purple"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
          {/* Voice Button */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={isLoading}
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
              isListening
                ? "bg-primary text-primary-foreground voice-pulse"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            )}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Mensagem para Kojak ${currentMode.label}...`}
            className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm leading-relaxed"
            rows={1}
            disabled={isLoading}
          />

          {/* Speaking Indicator / Stop Button */}
          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary animate-pulse"
            >
              <VolumeX className="w-5 h-5" />
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
              message.trim() && !isLoading
                ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-105"
                : "bg-white/5 text-muted-foreground cursor-not-allowed"
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

      {/* Hint - Hidden on mobile */}
      <p className="hidden md:block text-center text-xs text-muted-foreground mt-3">
        Pressione <kbd className="px-1.5 py-0.5 rounded-md glass-card text-foreground">Enter</kbd> para enviar • <kbd className="px-1.5 py-0.5 rounded-md glass-card text-foreground">Shift+Enter</kbd> para nova linha
      </p>
    </div>
  );
}
