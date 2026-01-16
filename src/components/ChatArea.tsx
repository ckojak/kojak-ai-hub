import { useState, useRef, useEffect } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  mode: string;
}

const modeInfo: Record<string, { title: string; description: string; function: string }> = {
  code: {
    title: "Kojak Code",
    description: "Desenvolvimento de software e scripts com IA.",
    function: "código kojak",
  },
  vision: {
    title: "Kojak Vision",
    description: "Criação de imagens profissionais e artes visuais.",
    function: "visão kojak",
  },
  motion: {
    title: "Kojak Motion",
    description: "Produção de vídeos cinematográficos em alta definição.",
    function: "movimento kojak",
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
      
      // 1. CHAMA A FUNÇÃO NO SUPABASE
      const { data, error } = await supabase.functions.invoke(modeConfig.function, {
        body: { prompt: content },
      });

      if (error) throw new Error(error.message);

      // 2. LÓGICA ESPECIAL PARA MOTION (VÍDEO)
      if (selectedMode === "motion" && data.prediction_id) {
        let status = "starting";
        const loadingId = "loading-" + Date.now();

        // Adiciona uma mensagem de "Processando"
        setMessages(prev => [...prev, {
          id: loadingId,
          role: "assistant",
          content: "Sua produção cinematográfica foi iniciada. A Kojak AI está renderizando os quadros, isso pode levar alguns minutos...",
          type: "text",
          timestamp: new Date()
        }]);

        // LOOP DE ESPERA (POLLING) - Resolve o erro de 60 segundos!
        while (status !== "succeeded" && status !== "failed") {
          await new Promise(r => setTimeout(r, 6000)); // Espera 6 segundos antes de checar de novo

          // IMPORTANTE: Aqui você deve ter o seu token da Replicate configurado
          // ou usar uma função intermediária no Supabase para segurança.
          const checkRes = await fetch(`https://api.replicate.com/v1/predictions/${data.prediction_id}`, {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_REPLICATE_API_TOKEN}` }
          });
          
          const result = await checkRes.json();
          status = result.status;

          if (status === "succeeded") {
            // Remove o aviso de carregamento e exibe o vídeo pronto
            setMessages(prev => prev.filter(m => m.id !== loadingId));
            setMessages(prev => [...prev, {
              id: data.prediction_id,
              role: "assistant",
              content: "O vídeo foi gerado com sucesso pela Kojak AI!",
              type: "video",
              mediaUrl: result.output,
              timestamp: new Date()
            }]);
            break;
          }

          if (status === "failed") {
            throw new Error("A geração do vídeo falhou no servidor da Replicate.");
          }
        }
      } else {
        // LÓGICA NORMAL PARA CODE E VISION
        const assistantMessage: Message = {
          id: data.id || Date.now().toString(),
          role: "assistant",
          content: data.content,
          type: data.type || "text",
          mediaUrl: data.mediaUrl,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#030014] relative">
      {/* Aurora de fundo */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

      {/* Header Futurista */}
      <header className="sticky top-0 z-10 px-6 py-4 bg-[#030014]/80 backdrop-blur-xl border-b border-white/5 flex flex-col items-center text-center">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 uppercase tracking-widest">
          {modeInfo[activeMode]?.title}
        </h1>
        <p className="text-xs text-blue-200/40 uppercase tracking-tighter">{modeInfo[activeMode]?.description}</p>
      </header>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-8">
        {messages.length === 0 ? (
          <EmptyState mode={activeMode} onSuggestionClick={(s) => sendMessage(s, activeMode)} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 text-purple-400 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Kojak processando...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-gradient-to-t from-[#030014] to-transparent">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            activeMode={activeMode}
            onModeChange={setActiveMode}
          />
        </div>
      </div>
    </div>
  );
}

// Componente de Estado Vazio com Estilo Profissional
function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (suggestion: string) => void }) {
  const suggestions: Record<string, string[]> = {
    code: ["Criar um script Python de automação", "Interface Dark Mode em React", "Explicar recursividade"],
    vision: ["Cidade Cyberpunk Neon", "Logo futurista de tecnologia", "Gato astronauta 4k"],
    motion: ["Explosão de galáxia 3D", "Cachoeira digital", "Carro futurista na chuva"],
  };

  return (
    <div className="max-w-2xl mx-auto text-center py-20 animate-fade-in">
      <div className="inline-flex p-5 rounded-3xl bg-purple-600/20 border border-purple-500/30 mb-8 animate-pulse">
        <Sparkles className="w-10 h-10 text-purple-400" />
      </div>
      <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Kojak AI à sua disposição.</h2>
      <p className="text-blue-200/40 mb-10 text-lg font-light">Selecione uma ideia ou digite seu prompt abaixo.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {(suggestions[mode] || suggestions.code).map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(s)}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-blue-100 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
