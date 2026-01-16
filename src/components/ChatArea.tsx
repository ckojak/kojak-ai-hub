import { useState, useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  mode: string;
}

const modeInfo: Record<string, { title: string; description: string }> = {
  code: { title: "Kojak Code", description: "Crie aplicativos e scripts profissionais." },
  vision: { title: "Kojak Vision", description: "Gere imagens cinematográficas com IA." },
  motion: { title: "Kojak Motion", description: "Produza vídeos em alta definição." },
};

export function ChatArea({ mode }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(mode);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { setActiveMode(mode); }, [mode]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (content: string, selectedMode: string) => {
    const userMessage: Message = { id: Date.now().toString(), role: "user", content, type: "text", timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/kojak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: content, modo: selectedMode }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const assistantMessage: Message = {
        id: data.id || Date.now().toString(),
        role: "assistant",
        content: data.content,
        type: data.type || "text",
        mediaUrl: data.mediaUrl,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const currentModeInfo = modeInfo[activeMode] || modeInfo.code;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-6 py-4 border-b border-kojak-border bg-background/50 backdrop-blur-md">
        <h1 className="text-xl font-bold text-white">{currentModeInfo.title}</h1>
        <p className="text-xs text-kojak-text-secondary">{currentModeInfo.description}</p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <EmptyState mode={activeMode} onSuggestionClick={(s) => sendMessage(s, activeMode)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
            {isLoading && <LoadingIndicator />}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 bg-background">
        <ChatInput onSend={sendMessage} isLoading={isLoading} activeMode={activeMode} onModeChange={setActiveMode} />
      </div>
    </div>
  );
}

function EmptyState({ mode, onSuggestionClick }: any) {
  const suggestions: any = {
    code: ["Crie um site em React", "Script Python para automação"],
    vision: ["Logo futurista roxa", "Cidade cyberpunk 4k"],
    motion: ["Mar batendo nas rochas", "Explosão de cores"],
  };
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 bg-primary/10 rounded-full mb-6"><Sparkles className="w-8 h-8 text-primary" /></div>
      <h2 className="text-2xl font-bold text-white mb-2">Como posso ajudar?</h2>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions[mode]?.map((s: string) => (
          <button key={s} onClick={() => onSuggestionClick(s)} className="px-4 py-2 bg-kojak-surface border border-kojak-border rounded-full text-sm hover:border-primary transition-all">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center gap-2 text-primary animate-pulse">
      <div className="w-2 h-2 bg-primary rounded-full" />
      <span className="text-sm font-medium">Kojak está pensando...</span>
    </div>
  );
}
