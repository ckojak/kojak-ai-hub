import { useRef, useEffect } from "react";

import {
  ChatMessage,
  Message,
} from "./ChatMessage";

import {
  ChatInput,
  SendMessagePayload,
} from "./ChatInput";

interface Props {
  messages: Message[];
  isLoading: boolean;

  onSendMessage: (
    payload: SendMessagePayload
  ) => Promise<void>;

  onSpeak?: (text: string) => void;

  referenceImage?: string | null;
  onClearReference?: () => void;
}

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onSpeak,
  referenceImage,
  onClearReference,
}: Props) {
  const ref =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView();
  }, [messages]);

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto">

        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            onSpeak={onSpeak}
          />
        ))}

        <div ref={ref} />

      </div>

      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        referenceImage={referenceImage}
        onClearReference={onClearReference}
      />

    </div>
  );
}