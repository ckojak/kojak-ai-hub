import { useState, useCallback } from "react";

import { SendHorizonal } from "lucide-react";

interface Props {

  onSend: (message: string) => Promise<void> | void;

  disabled?: boolean;

}

export function ChatInput({ onSend, disabled }: Props) {

  const [value, setValue] = useState("");

  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {

    const text = value.trim();

    if (!text) return;

    if (sending || disabled) return;

    try {

      setSending(true);

      await onSend(text);

      setValue("");

    } catch (error) {

      console.error("Send message error:", error);

    } finally {

      setSending(false);

    }

  }, [value, sending, disabled, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {

    if (e.key === "Enter" && !e.shiftKey) {

      e.preventDefault();

      handleSend();

    }

  }, [handleSend]);

  return (

    <div className="border-t border-border p-3 bg-background">

      <div className="flex items-center gap-2">

        <input

          type="text"

          value={value}

          onChange={(e) => setValue(e.target.value)}

          onKeyDown={handleKeyDown}

          placeholder="Digite sua mensagem..."

          disabled={disabled || sending}

          className="flex-1 px-4 py-3 rounded-xl bg-muted outline-none focus:ring-2 focus:ring-primary"

        />

        <button

          onClick={handleSend}

          disabled={disabled || sending || !value.trim()}

          className="p-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"

        >

          <SendHorizonal size={18} />

        </button>

      </div>

    </div>

  );

}