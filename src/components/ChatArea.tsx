import { useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { Sparkles, Code2, Camera, Play, MessageCircle } from "lucide-react";
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
}

const modeInfo = {
  chat: { icon: MessageCircle, label: "Conversa Livre", color: "text-emerald-400", description: "Converse livremente sobre qualquer assunto" },
  code: { icon: Code2, label: "Kojak Code", color: "text-blue-400", description: "Crie aplicativos e código profissional" },
  vision: { icon: Camera, label: "Kojak Vision", color: "text-amber-400", description: "Gere imagens profissionais com IA" },
  motion: { icon: Play, label: "Kojak Motion", color: "text-rose-400", description: "Crie vídeos em alta definição" },
};

const suggestions: Record<string, string[]> = {
  chat: [
    "Me explique como funciona a IA",
    "Quais são as tendências de tecnologia?",
    "Dicas para produtividade no trabalho",
  ],
  code: [
    "Crie uma API REST em Node.js com Express",
    "Faça um componente React de formulário de login",
    "Escreva um script Python para web scraping",
  ],
  vision: [
    "Logo minimalista para startup de tecnologia",
    "Ilustração futurista de cidade cyberpunk",
    "Banner profissional para rede social",
  ],
  motion: [
    "Ondas do mar ao pôr do sol em câmera lenta",
    "Animação abstrata com partículas coloridas",
    "Paisagem de montanhas com nuvens passando",
  ],
};

function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (text: string) => void }) {
  const info = modeInfo[mode as keyof typeof modeInfo] || modeInfo.chat;
  const Icon = info.icon;
  const modeSuggestions = suggestions[mode] || suggestions.chat;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        {/* Logo */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-purple rounded-2xl blur-xl opacity-50 animate-pulse-slow" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-purple flex items-center justify-center glow-purple-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gradient-purple mb-2">
          Kojak IA
        </h2>
        <p className="text-muted-foreground mb-6">
          Plataforma Multimodal de Inteligência Artificial
        </p>

        {/* Current Mode */}
        <div className="glass-card rounded-2xl p-4 mb-6 neon-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon className={cn("w-5 h-5", info.color)} />
            <span className="font-semibold">{info.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>

        {/* Suggestions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Experimente perguntar:</p>
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
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSuggestionClick = (text: string) => {
    onSendMessage(text, activeMode);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState mode={activeMode} onSuggestionClick={handleSuggestionClick} />
      ) : (
        <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSpeak={onSpeak}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input */}
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
      />
    </div>
  );
}
