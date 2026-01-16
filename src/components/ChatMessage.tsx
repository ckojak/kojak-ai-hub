import { Download, Copy, Check, User, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "code" | "image" | "video";
  language?: string;
  mediaUrl?: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.click();
  };

  return (
    <div className={cn(
      "flex gap-3 md:gap-4 animate-fade-in mb-6",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar Futurista */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-tighter",
        isUser
          ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
          : "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
      )}>
        {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </div>

      {/* Balão de Mensagem */}
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-2xl",
        isUser
          ? "bg-purple-700 text-white rounded-tr-none border border-purple-500/30" // ROXO PARA O USUÁRIO
          : "bg-white/5 backdrop-blur-xl text-blue-50 rounded-tl-none border border-white/10" // ESTILO VIDRO PARA KOJAK
      )}>
        
        {/* Conteúdo de Texto / Markdown */}
        {(!message.type || message.type === "text" || message.type === "code") && (
          <div className={cn(
            "text-sm leading-relaxed prose prose-sm max-w-none",
            isUser ? "prose-invert" : "prose-invert opacity-90"
          )}>
            <ReactMarkdown
              components={{
                // Estilização customizada para blocos de código
                pre: ({ children }) => (
                  <div className="relative group/code my-4">
                    <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto border border-white/5 backdrop-blur-sm">
                      {children}
                    </pre>
                  </div>
                ),
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  return !match ? (
                    <code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={cn("text-xs font-mono text-blue-200", className)} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Botão de Copiar (Apenas se for código ou texto longo) */}
        {!isUser && message.content.length > 20 && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => handleCopy(message.content)}
              className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-white/40 hover:text-purple-400 transition-colors"
            >
              {copied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
            </button>
          </div>
        )}

        {/* Mídia: Imagem */}
        {message.type === "image" && message.mediaUrl && (
          <div className="space-y-3 mt-2">
            <div className="relative group rounded-xl overflow-hidden border border-white/10">
              <img src={message.mediaUrl} alt="IA Content" className="w-full max-w-md" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => handleDownload(message.mediaUrl!, "kojak-img.png")}
                  className="p-3 bg-purple-600 text-white rounded-full hover:scale-110 transition-transform"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mídia: Vídeo */}
        {message.type === "video" && message.mediaUrl && (
          <div className="mt-2 relative rounded-xl overflow-hidden bg-black border border-white/10">
            <video src={message.mediaUrl} className="w-full max-w-lg" controls />
            <button
              onClick={() => handleDownload(message.mediaUrl!, "kojak-vid.mp4")}
              className="absolute top-2 right-2 p-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Timestamp / Horário */}
        <div className={cn(
          "mt-2 text-[10px] font-medium opacity-40 uppercase tracking-widest",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
