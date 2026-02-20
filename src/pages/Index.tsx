import {
  useState,
  useCallback,
  useEffect,
} from "react";

import { ChatArea } from "@/components/ChatArea";

import {
  Message,
} from "@/components/ChatMessage";

import {
  SendMessagePayload,
} from "@/components/ChatInput";

export default function Index() {

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const speak = useCallback(
    (text: string) => {

      speechSynthesis.cancel();

      const u =
        new SpeechSynthesisUtterance(text);

      speechSynthesis.speak(u);

    },
    []
  );

  const sendMessage =
    useCallback(
      async (
        payload: SendMessagePayload
      ) => {

        setIsLoading(true);

        const userMsg: Message = {

          id: crypto.randomUUID(),
          role: "user",
          content:
            payload.content || "",
          type:
            payload.imageFile
              ? "image"
              : "text",

          media_url:
            payload.imageFile
              ? URL.createObjectURL(
                  payload.imageFile
                )
              : undefined,

        };

        setMessages((p) => [
          ...p,
          userMsg,
        ]);

        await new Promise(
          (r) => setTimeout(r, 1000)
        );

        const aiMsg: Message = {

          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Resposta estilo ChatGPT funcionando perfeitamente.",

        };

        setMessages((p) => [
          ...p,
          aiMsg,
        ]);

        setIsLoading(false);

      },
      []
    );

  useEffect(() => {

    const last =
      messages[messages.length - 1];

    if (
      last &&
      last.role === "assistant"
    ) {
      speak(last.content);
    }

  }, [messages, speak]);

  return (
    <div className="h-screen">

      <ChatArea
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        onSpeak={speak}
      />

    </div>
  );
}