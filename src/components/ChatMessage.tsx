import { Download, Copy, Check, User, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "code" | "image" | "video";
  language?: string;
  media_url?: string;
  created_at?: string;
}

interface ChatMessageProps {
  message: Message;
  onSpeak?: (text: string) => void;
}

export function ChatMessage({ message, onSpeak }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const formatTime = () => {
    if (message.created_at) {
      return new Date(message.created_at).toLocaleTimeString("pt-BR", { 
        hour: "2-digit", 
        minute: "2-digit" 
      });
    }
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={cn(
      "flex gap-3 animate-fade-in",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
        isUser
          ? "bg-gradient-purple glow-purple"
          : "bg-gradient-to-br from-primary/40 to-secondary/30 border border-primary/30"
      )}>
        {isUser ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-primary" />}
      </div>

      {/* Message Bubble */}
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3",
        isUser
          ? "bubble-user text-white rounded-tr-sm"
          : "bubble-ai rounded-tl-sm"
      )}>
        
        {/* Text / Markdown Content */}
        {(!message.type || message.type === "text" || message.type === "code") && (
          <div className={cn(
            "text-sm leading-relaxed prose prose-sm max-w-none",
            isUser ? "prose-invert" : "prose-kojak"
          )}>
            <ReactMarkdown
              components={{
                pre: ({ children }) => (
                  <div className="relative group/code my-3">
                    <pre className="code-block p-4 overflow-x-auto">
                      {children}
                    </pre>
                    <button
                      onClick={() => {
                        const codeText = (children as React.ReactElement)?.props?.children;
                        if (codeText) handleCopy(String(codeText));
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 opacity-0 group-hover/code:opacity-100 transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ),
                code: ({ className, children, ...props }: any) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary text-[0.85em]" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={cn("text-sm font-mono", className)} {...props}>
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Actions for AI messages */}
        {!isUser && message.content.length > 20 && (
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/10">
            <button
              onClick={() => handleCopy(message.content)}
              className="flex items-center gap-1.5 text-[10px] uppercase font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            {onSpeak && (
              <button
                onClick={() => onSpeak(message.content)}
                className="flex items-center gap-1.5 text-[10px] uppercase font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Ouvir
              </button>
            )}
          </div>
        )}

        {/* Image */}
        {message.type === "image" && message.media_url && (
          <div className="relative group rounded-xl overflow-hidden mt-2">
            <img src={message.media_url} alt="Generated by Kojak Vision" className="w-full max-w-md rounded-xl" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => handleDownload(message.media_url!, "kojak-image.png")}
                className="p-3 bg-gradient-purple text-white rounded-full hover:scale-110 transition-transform glow-purple"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            {message.content && (
              <p className="mt-2 text-sm text-muted-foreground">{message.content}</p>
            )}
          </div>
        )}

        {/* Video */}
        {message.type === "video" && message.media_url && (
          <div className="relative rounded-xl overflow-hidden mt-2">
            <video src={message.media_url} className="w-full max-w-lg rounded-xl" controls />
            <button
              onClick={() => handleDownload(message.media_url!, "kojak-video.mp4")}
              className="absolute top-2 right-2 p-2 bg-gradient-purple text-white rounded-lg hover:scale-105 transition-transform"
            >
              <Download className="w-4 h-4" />
            </button>
            {message.content && (
              <p className="mt-2 text-sm text-muted-foreground">{message.content}</p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={cn(
          "mt-2 text-[10px] font-medium opacity-50",
          isUser ? "text-right" : "text-left"
        )}>
          {formatTime()}
        </div>
      </div>
    </div>
  );
}
