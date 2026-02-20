import { useState, useRef } from "react";
import { Send, X } from "lucide-react";

interface Props {

  onSend: (content: string) => Promise<void>;

  isLoading: boolean;

  referenceImage?: string | null;

  onClearReference?: () => void;

}

export function ChatInput({

  onSend,

  isLoading,

  referenceImage,

  onClearReference,

}: Props) {

  const [text, setText] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSend() {

    if (!text.trim()) return;

    await onSend(text);

    setText("");

    inputRef.current?.focus();

  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {

    if (e.key === "Enter") {

      e.preventDefault();

      handleSend();

    }

  }

  return (

    <div className="border-t border-white/10 p-3 bg-black">

      {referenceImage && (

        <div className="relative mb-2 inline-block">

          <img
            src={referenceImage}
            className="h-20 rounded-lg"
          />

          {onClearReference && (

            <button
              onClick={onClearReference}
              className="absolute top-1 right-1 bg-black/70 rounded-full p-1"
            >
              <X size={14} />
            </button>

          )}

        </div>

      )}

      <div className="flex gap-2">

        <input

          ref={inputRef}

          value={text}

          onChange={(e) => setText(e.target.value)}

          onKeyDown={handleKeyDown}

          placeholder="Digite sua mensagem..."

          className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 outline-none"

        />

        <button

          onClick={handleSend}

          disabled={isLoading}

          className="bg-white text-black px-3 rounded-lg disabled:opacity-50"

        >

          <Send size={18} />

        </button>

      </div>

    </div>

  );

}