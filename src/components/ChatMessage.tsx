import {
  Copy,
  Check,
  Download,
  User,
  Sparkles,
  Volume2,
  ImagePlus,
} from "lucide-react";

import { memo, useState, useCallback } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "image";
  media_url?: string;
  created_at?: string;
}

interface Props {
  message: Message;
  onSpeak?: (text: string) => void;
  onSelectReference?: (url: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onSpeak,
  onSelectReference,
}: Props) {

  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }, [message.content]);

  const download = useCallback(async () => {

    if (!message.media_url) return;

    try {

      const res = await fetch(message.media_url);

      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = "image.png";

      document.body.appendChild(a);

      a.click();

      a.remove();

      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Download error:", error);
    }

  }, [message.media_url]);

  return (

    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>

      <div className="mt-1 text-muted-foreground">
        {isUser ? <User size={18} /> : <Sparkles size={18} />}
      </div>

      <div className="max-w-[75%] space-y-2">

        {message.type === "image" && message.media_url && (

          <div className="relative group">

            <img
              src={message.media_url}
              alt="Generated"
              className="rounded-xl max-w-full"
              loading="lazy"
            />

            {!isUser && (

              <div className="opacity-0 group-hover:opacity-100 transition absolute inset-0 bg-black/60 flex gap-2 justify-center items-center rounded-xl">

                <button
                  onClick={download}
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
                >
                  <Download size={18} />
                </button>

                {onSelectReference && (
                  <button
                    onClick={() => onSelectReference(message.media_url!)}
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
                  >
                    <ImagePlus size={18} />
                  </button>
                )}

              </div>

            )}

          </div>

        )}

        {message.content && (

          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bubble-user text-white"
              : "bubble-ai text-foreground"
          }`}>

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
            >
              {message.content}
            </ReactMarkdown>

          </div>

        )}

        {!isUser && (

          <div className="flex gap-2">

            <button
              onClick={copy}
              className="p-1 hover:bg-white/10 rounded"
            >
              {copied ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
            </button>

            {onSpeak && (

              <button
                onClick={() => onSpeak(message.content)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <Volume2 size={16} />
              </button>

            )}

          </div>

        )}

      </div>

    </div>

  );

});