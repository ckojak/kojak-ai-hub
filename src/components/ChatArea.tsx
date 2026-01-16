import { useState, useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  mode: string;
}

const modeInfo: Record<string, { title: string; description: string; function: string }> = {
  code: {
    title: "Kojak Code",
    description: "Crie aplicativos, scripts e código em qualquer linguagem de programação.",
    function: "kojak-code",
  },
  vision: {
    title: "Kojak Vision",
    description: "Gere imagens profissionais e criativas com inteligência artificial.",
    function: "kojak-vision",
  },
  motion: {
    title: "Kojak Motion",
    description: "Produza vídeos em alta definição com IA generativa.",
    function: "kojak-motion",
  },
};

export function ChatArea({ mode }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(mode);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string, selectedMode: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      type: "text",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const modeConfig = modeInfo[selectedMode] || modeInfo.code;
      
      const { data, error } = await supabase.functions.invoke(modeConfig.function, {
        body: { prompt: content },
      });

      if (error) {
        throw new Error(error.message || "Erro ao processar requisição");
      }

      if (data.error) {
        if (data.requiresSetup) {
          toast({
            title: "Configuração necessária",
            description: data.error,
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      const assistantMessage: Message = {
        id: data.id || (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        type: data.type || "text",
        language: data.language,
        mediaUrl: data.mediaUrl,
        timestamp: new Date(data.timestamp || Date.now()),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });

      // Add error message to chat
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
        type: "text",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion, activeMode);
  };

  const currentModeInfo = modeInfo[activeMode] || modeInfo.code;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 px-6 py-4 bg-background/80 backdrop-blur-lg border-b border-kojak-border">
        <h1 className="text-xl font-semibold text-foreground">{currentModeInfo.title}</h1>
        <p className="text-sm text-muted-foreground">{currentModeInfo.description}</p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-6 py-6">
        {messages.length === 0 ? (
          <EmptyState mode={activeMode} onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <LoadingIndicator />}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        activeMode={activeMode}
        onModeChange={setActiveMode}
      />
    </div>
  );
}

function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (suggestion: string) => void }) {
  const suggestions: Record<string, string[]> = {
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

  return (
    <div className="max-w-2xl mx-auto text-center py-16 animate-fade-in">
      <div className="inline-flex p-4 rounded-2xl bg-gradient-purple glow-purple-lg mb-6 animate-float">
        <Sparkles className="w-8 h-8 text-primary-foreground" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">
        Como posso ajudar você hoje?
      </h2>
      <p className="text-muted-foreground mb-8">
        Comece uma conversa ou escolha uma sugestão abaixo
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {(suggestions[mode] || suggestions.code).map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(suggestion)}
            className="px-4 py-2 rounded-full bg-kojak-surface border border-kojak-border text-sm text-foreground hover:border-primary/50 hover:bg-kojak-charcoal transition-all duration-200"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center">
        <span className="text-xs font-semibold text-primary-foreground">K</span>
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-sm text-muted-foreground">Processando...</span>
    </div>
  );
}
