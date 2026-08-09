import { useRef, useEffect, useMemo } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { Sparkles, Code2, Camera, Play, MessageCircle, HeartPulse } from "lucide-react";
import { KOJAK_LOGO_BASE64 } from "@/assets/kojak-logo";
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
  aiTier?: "rapido" | "raciocinio";
  onTierChange?: (tier: "rapido" | "raciocinio") => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
}

const modeInfo = {
  chat: { icon: MessageCircle, label: "Conversa Livre", color: "text-emerald-400", description: "Converse livremente sobre qualquer assunto" },
  code: { icon: Code2, label: "Kojak Code", color: "text-blue-400", description: "Crie aplicativos e código profissional" },
  vision: { icon: Camera, label: "Kojak Vision", color: "text-amber-400", description: "Gere imagens profissionais com IA" },
  motion: { icon: Play, label: "Kojak Motion", color: "text-rose-400", description: "Crie vídeos em alta definição" },
  saude: { icon: HeartPulse, label: "Kojak Saúde", color: "text-pink-400", description: "Estrategista científico em Saúde Pública" },
};

const suggestions: Record<string, string[]> = {
  chat: [
    "Me explique como funciona a IA generativa",
    "Quais são as tendências de tecnologia em 2026?",
    "Dicas práticas para produtividade",
    "Como investir com pouco dinheiro?",
    "Me dá ideias de negócio pra começar",
    "Explica um assunto complexo de forma simples",
    "Como melhorar minha comunicação no trabalho?",
    "Quais livros valem a pena ler esse ano?",
    "Como funciona o mercado de criptomoedas?",
  ],
  code: [
    "Crie uma API REST em Node.js com Express",
    "Componente React de formulário de login",
    "Script Python para web scraping",
    "Explica diferença entre SQL e NoSQL",
    "Função JavaScript pra validar CPF",
    "Como configurar autenticação com Supabase",
    "Otimiza esse código pra rodar mais rápido",
    "Cria um bot simples de Telegram",
    "Como funciona Docker na prática",
  ],
  vision: [
    "Logo minimalista para startup de tecnologia",
    "Cidade cyberpunk futurista ao entardecer",
    "Banner profissional para rede social",
    "Retrato estilo pintura a óleo",
    "Paisagem de montanha ao nascer do sol",
    "Personagem de anime em estilo realista",
    "Capa de álbum musical futurista",
    "Ilustração de floresta mágica",
    "Design de embalagem de produto premium",
  ],
  motion: [
    "Ondas do mar ao pôr do sol em câmera lenta",
    "Animação abstrata com partículas coloridas",
    "Montanhas com nuvens passando rapidamente",
    "Chuva caindo numa janela à noite",
    "Fogueira crepitando em close",
    "Cidade iluminada à noite, câmera aérea",
    "Flores desabrochando em timelapse",
    "Fumaça colorida se movendo no ar",
    "Estrelas e galáxias em movimento",
  ],
  saude: [
    "Como aliviar dor de cabeça sem remédio",
    "Alimentação para ganho de massa magra",
    "Quando devo procurar um médico com urgência?",
    "Como melhorar a qualidade do sono",
    "Sinais de estresse que não posso ignorar",
    "Benefícios de caminhar todo dia",
    "Como reduzir a ansiedade no dia a dia",
    "Alimentos que ajudam a imunidade",
    "Diferença entre gripe e resfriado",
  ],
};

function pickRandomSuggestions(pool: string[], count = 3): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (text: string) => void }) {
  const info = modeInfo[mode as keyof typeof modeInfo] || modeInfo.chat;
  const Icon = info.icon;
  const pool = suggestions[mode] || suggestions.chat;
  // useMemo garante que sorteia só quando o modo muda, não a cada re-render
  const modeSuggestions = useMemo(() => pickRandomSuggestions(pool), [mode]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-purple rounded-2xl blur-xl opacity-50 animate-pulse-slow" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-purple flex items-center justify-center glow-purple-lg overflow-hidden">
            <img src={KOJAK_LOGO_BASE64} alt="Kojak.AI" className="w-full h-full object-cover" />
          </div>
        </div>

        <p className="text-muted-foreground mb-6">
          Plataforma Multimodal de Artificial Intelligence
        </p>

        <div className="glass-card rounded-2xl p-4 mb-6 neon-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon className={cn("w-5 h-5", info.color)} />
            <span className="font-semibold">{info.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>

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
  referenceImage,
  onSelectReference,
  onClearReference,
  aiTier,
  onTierChange,
  isLoggedIn,
  onRequireLogin,
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
                onSelectReference={onSelectReference} // <--- REPASSE PARA A MENSAGEM
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
        referenceImage={referenceImage}     // <--- REPASSE PARA O VISOR DO INPUT
        onClearReference={onClearReference} // <--- REPASSE PARA O VISOR DO INPUT
        aiTier={aiTier}
        onTierChange={onTierChange}
        isLoggedIn={isLoggedIn}
        onRequireLogin={onRequireLogin}
      />
    </div>
  );
}