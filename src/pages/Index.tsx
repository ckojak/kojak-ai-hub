import { useState, useCallback, useEffect, useRef } from "react";

import { ChatArea } from "@/components/ChatArea";
import { Message } from "@/components/ChatMessage";

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const speak = useCallback((text: string) => {
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.onstart = () =>
      setIsSpeaking(true);

    utterance.onend = () =>
      setIsSpeaking(false);

    utterance.onerror = () =>
      setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);

  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const sendMessage = useCallback(
    async ({
      content,
      imageFile,
    }: {
      content?: string;
      imageFile?: File | null;
    }) => {
      if (!content && !imageFile) return;

      setIsLoading(true);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content || "",
        type: imageFile ? "image" : "text",
        media_url: imageFile
          ? URL.createObjectURL(imageFile)
          : undefined,
      };

      setMessages((prev) => [
        ...prev,
        userMessage,
      ]);

      try {
        abortControllerRef.current =
          new AbortController();

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );

        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Resposta profissional simulada.",
        };

        setMessages((prev) => [
          ...prev,
          aiMessage,
        ]);

      } catch (err) {
        console.error(err);

      } finally {
        setIsLoading(false);
      }
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
      const timer = setTimeout(() => {
        speak(last.content);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [messages, speak]);

  return (
    <div className="h-screen">

      <ChatArea
        messages={messages}
        isLoading={isLoading}
        activeMode="chat"
        onModeChange={() => {}}
        onSendMessage={sendMessage}
        onSpeak={speak}
        onStopSpeaking={stopSpeaking}
      />

    </div>
  );
}