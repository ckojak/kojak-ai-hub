import { useRef, useEffect, useMemo } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { Code2, Camera, Play, MessageCircle, HeartPulse } from "lucide-react";
import { KOJAK_LOGO_BASE64 } from "@/assets/kojak-logo";
import { useLanguage } from "@/hooks/useLanguage";
import { suggestionsByLang } from "@/i18n/suggestions";
import { cn } from "@/lib/utils";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
  onSendMessage: (content: string, mode: string, imageUrl?: string) => void;
  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
  referenceImage?: string | null;
  onSelectReference?: (url: string) => void;
  onClearReference?: () => void;
  aiTier?: "basico" | "rapido" | "avancado" | "raciocinio";
  onTierChange?: (tier: "basico" | "rapido" | "avancado" | "raciocinio") => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
}

const modeInfo = {
  chat: { icon: MessageCircle, label: "modeChat", color: "text-emerald-400", description: "modeChatDesc" },
  code: { icon: Code2, label: "modeCode", color: "text-blue-400", description: "modeCodeDesc" },
  vision: { icon: Camera, label: "modeVision", color: "text-amber-400", description: "modeVisionDesc" },
  motion: { icon: Play, label: "modeMotion", color: "text-rose-400", description: "modeMotionDesc" },
  saude: { icon: HeartPulse, label: "modeSaude", color: "text-pink-400", description: "modeSaudeDesc" },
};

function pickRandomSuggestions(pool: string[], count = 3): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (text: string) => void }) {
  const { t, language } = useLanguage();
  const info = modeInfo[mode as keyof typeof modeInfo] || modeInfo.chat;
  const Icon = info.icon;
  const pool = suggestionsByLang[language]?.[mode] || suggestionsByLang[language]?.chat || [];
  // Sorteia só quando o modo ou o idioma muda, não a cada re-render.
  const modeSuggestions = useMemo(() => pickRandomSuggestions(pool), [mode, language]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-purple rounded-2xl blur-xl opacity-50 animate-pulse-slow" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-purple flex items-center justify-center glow-purple-lg overflow-hidden">
            <img src={KOJAK_LOGO_BASE64} alt="Kojak IA" className="w-full h-full object-cover" />
          </div>
        </div>

        <p className="text-muted-foreground mb-6">{t("tagline")}</p>

        <div className="glass-card rounded-2xl p-4 mb-6 neon-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon className={cn("w-5 h-5", info.color)} />
            <span className="font-semibold">{t(info.label)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t(info.description)}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">{t("tryAsking")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {modeSuggestions.map((text, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(text)}
                className="px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatArea({
  messages,
  isLoading,
  activeMode,
  onModeChange,
  onSendMessage,
  voiceTranscript,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onSpeak,
  onStopSpeaking,
  referenceImage,
  onSelectReference,
  onClearReference,
  aiTier,
  onTierChange,
  isLoggedIn,
  onRequireLogin,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSuggestionClick = (text: string) => {
    onSendMessage(text, activeMode);
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !isLoading ? (
        <EmptyState mode={activeMode} onSuggestionClick={handleSuggestionClick} />
      ) : (
        <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSpeak={onSpeak}
                onSelectReference={onSelectReference}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        activeMode={activeMode}
        onModeChange={onModeChange}
        voiceTranscript={voiceTranscript}
        isListening={isListening}
        isSpeaking={isSpeaking}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
        onStopSpeaking={onStopSpeaking}
        referenceImage={referenceImage}
        onClearReference={onClearReference}
        aiTier={aiTier}
        onTierChange={onTierChange}
        isLoggedIn={isLoggedIn}
        onRequireLogin={onRequireLogin}
      />
    </div>
  );
}
