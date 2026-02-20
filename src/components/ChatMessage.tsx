import { Download, Copy, Check, User, Sparkles, Volume2, ImagePlus } from "lucide-react";
import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

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
  onSelectReference?: (url: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onSpeak,
  onSelectReference,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      const timer = setTimeout(() => setCopied(false), 2000);

      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, []);

  const handleDownload = useCallback(async (url: string, filename: string) => {
    let objectUrl: string | null = null;

    try {
      const res = await fetch(url);

      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();

      objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      console.error("Download error:", err);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const formatTime = useCallback(() => {
    const date = message.created_at
      ? new Date(message.created_at)
      : new Date();

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [message.created_at]);

  const shouldRenderText =
    message.content && message.content.trim().length > 0;

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
          isUser
            ? "bg-gradient-purple glow-purple"
            : "bg-gradient-to-br from-primary/40 to-secondary/30 border border-primary/30"
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Sparkles className="w-5 h-5 text-primary" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3",
          isUser
            ? "bubble-user text-white rounded-tr-sm"
            : "bubble-ai rounded-tl-sm"
        )}
      >
        {shouldRenderText && (
          <div
            className={cn(
              "text-sm leading-relaxed prose prose-sm max-w-none",
              isUser ? "prose-invert" : "prose-kojak"
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.type === "image" && message.media_url && (
          <div className="relative group rounded-xl overflow-hidden mt-2">
            <img
              src={message.media_url}
              className="rounded-xl max-w-md"
            />

            {!isUser && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex gap-3 items-center justify-center transition">
                <button
                  onClick={() =>
                    handleDownload(
                      message.media_url!,
                      "kojak-image.png"
                    )
                  }
                >
                  <Download />
                </button>

                {onSelectReference && (
                  <button
                    onClick={() =>
                      onSelectReference(message.media_url!)
                    }
                  >
                    <ImagePlus />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!isUser && shouldRenderText && (
          <div className="flex gap-3 mt-3 pt-2 border-t border-white/10">
            <button onClick={() => handleCopy(message.content)}>
              {copied ? <Check /> : <Copy />}
            </button>

            {onSpeak && (
              <button onClick={() => onSpeak(message.content)}>
                <Volume2 />
              </button>
            )}
          </div>
        )}

        <div className="text-xs opacity-50 mt-2">
          {formatTime()}
        </div>
      </div>
    </div>
  );
});