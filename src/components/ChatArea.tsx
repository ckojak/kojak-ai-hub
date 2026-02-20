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

  const ref = useRef<HTMLDivElement>(null);

  /*
  ---------------------------------------
  AUTO SCROLL
  ---------------------------------------
  */

  useEffect(() => {

    ref.current?.scrollIntoView({

      behavior: "smooth",

    });

  }, [messages, isLoading]);

  /*
  ---------------------------------------
  SAFETY
  ---------------------------------------
  */

  const safeMessages = messages ?? [];

  /*
  ---------------------------------------
  UI
  ---------------------------------------
  */

  return (

    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* EMPTY STATE */}

        {safeMessages.length === 0 && !isLoading && (

          <div className="text-center text-muted-foreground mt-10">

            Kojak AI pronta.

          </div>

        )}

        {/* MESSAGES */}

        {safeMessages.map((m) => (

          <ChatMessage
            key={m.id}
            message={m}
            onSpeak={onSpeak}
          />

        ))}

        {/* LOADING */}

        {isLoading && (

          <div className="text-sm text-muted-foreground">

            Pensando...

          </div>

        )}

        <div ref={ref} />

      </div>

      {/* INPUT */}

      <ChatInput

        onSend={onSendMessage}

        isLoading={isLoading}

        referenceImage={referenceImage}

        onClearReference={onClearReference}

      />

    </div>

  );

}