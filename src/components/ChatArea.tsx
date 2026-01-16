import { useState, useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sparkles } from "lucide-react";
// Removido o import do supabase que dependia de créditos
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  mode: string;
}

const modeInfo: Record<string, { title: string; description: string }> = {
  code: {
    title: "Kojak Code",
    description: "Crie aplicativos, scripts e código em qualquer linguagem de programação.",
  },
  vision: {
    title: "Kojak Vision",
    description: "Gere imagens profissionais e criativas com inteligência artificial.",
  },
  motion: {
    title: "Kojak Motion",
    description: "Produza vídeos em alta definição com IA generativa.",
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
      // CHAMADA DIRETA PARA A VERCEL (Independente de créditos do Lovable)
      const response = await fetch('/api/kojak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: content, modo: selectedMode }),
      });

      if (!response.ok) {
        throw new Error("Erro na comunicação com o servidor. Verifique as chaves na Vercel.");
      }

      const data = await response.json();

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
      console.error("Erro Kojak:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro de Conexão",
        description: errorMessage,
        variant: "destructive",
      });

      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Verifique se as APIs estão configuradas na Vercel.`,
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
    // Adicionado pb-20 no mobile para não cobrir o input com a barra inferior
    <div className="flex flex-col h-full pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 px-6 py-4 bg-background/80 backdrop-blur-lg border-b border-kojak-border">
        <h1 className="text-xl font-semibold text-foreground">{currentModeInfo.title}</h1>
        <p className="text-sm text-muted-foreground">{currentModeInfo.description}</p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 md:px-6 py-6">
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

// ... (Resto do código EmptyState e LoadingIndicator permanecem iguais)
