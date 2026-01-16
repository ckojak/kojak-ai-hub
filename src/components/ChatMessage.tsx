import { Download, Copy, Check, Play, Pause } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  const [isPlaying, setIsPlaying] = useState(false);

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
    link.click();
  };

  return (
    <div
      className={cn(
        "flex gap-4 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold",
          isUser
            ? "bg-kojak-surface text-foreground"
            : "bg-gradient-purple text-primary-foreground glow-purple"
        )}
      >
        {isUser ? "Você" : "K"}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-kojak-surface text-foreground rounded-tr-sm"
            : "bg-kojak-charcoal text-foreground rounded-tl-sm border border-kojak-border"
        )}
      >
        {/* Text Content */}
        {(!message.type || message.type === "text") && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}

        {/* Code Block */}
        {message.type === "code" && (
          <div className="code-block">
            <div className="flex items-center justify-between px-4 py-2 bg-kojak-dark border-b border-kojak-border">
              <span className="text-xs text-kojak-text-secondary font-mono">
                {message.language || "código"}
              </span>
              <button
                onClick={() => handleCopy(message.content)}
                className="flex items-center gap-1 text-xs text-kojak-text-secondary hover:text-primary transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground">
              <code>{message.content}</code>
            </pre>
          </div>
        )}

        {/* Image */}
        {message.type === "image" && message.mediaUrl && (
          <div className="space-y-3">
            {message.content && (
              <p className="text-sm text-muted-foreground mb-2">{message.content}</p>
            )}
            <div className="relative group rounded-lg overflow-hidden">
              <img
                src={message.mediaUrl}
                alt="Imagem gerada"
                className="w-full max-w-md rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => handleDownload(message.mediaUrl!, "kojak-image.png")}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video */}
        {message.type === "video" && message.mediaUrl && (
          <div className="space-y-3">
            {message.content && (
              <p className="text-sm text-muted-foreground mb-2">{message.content}</p>
            )}
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                src={message.mediaUrl}
                className="w-full max-w-lg rounded-lg"
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <button
                onClick={() => handleDownload(message.mediaUrl!, "kojak-video.mp4")}
                className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-primary text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "mt-2 text-xs text-kojak-text-secondary",
            isUser ? "text-right" : "text-left"
          )}
        >
          {message.timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
