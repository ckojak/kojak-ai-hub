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

    await navigator.clipboard.writeText(message.content);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  }, [message.content]);

  const download = useCallback(async () => {

    if (!message.media_url) return;

    const res = await fetch(message.media_url);
    const blob = await res.blob();

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "image.png";
    a.click();

    URL.revokeObjectURL(url);

  }, [message.media_url]);

  return (

    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>

      <div>
        {isUser ? <User /> : <Sparkles />}
      </div>

      <div className="max-w-[75%]">

        {message.type === "image" && message.media_url && (

          <div className="relative group">

            <img
              src={message.media_url}
              className="rounded-xl"
              alt="generated"
            />

            {!isUser && (

              <div className="opacity-0 group-hover:opacity-100 absolute inset-0 bg-black/60 flex gap-2 justify-center items-center">

                <button onClick={download}>
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

        {message.content && (

          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>

        )}

        {!isUser && (

          <div className="flex gap-2 mt-1">

            <button onClick={copy}>
              {copied ? <Check /> : <Copy />}
            </button>

            {onSpeak && (
              <button onClick={() => onSpeak(message.content)}>
                <Volume2 />
              </button>
            )}

          </div>

        )}

      </div>

    </div>

  );

});