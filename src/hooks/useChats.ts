import { useState, useCallback } from "react";
import { Message } from "@/components/ChatMessage";
import { SendMessagePayload } from "@/components/ChatInput";

const GEMINI_API_KEY = "AIzaSyCSpFXPbWmtuI6ztBYTUSf7pYnZqyLXAtI";

export function useChats() {

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (payload: SendMessagePayload) => {

    if (!payload.content) return;

    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: payload.content,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: payload.content }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();

      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sem resposta da IA.";

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiText,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

    }
    catch (error) {

      console.error(error);

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Erro ao conectar com a IA.",
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);

    }
    finally {

      setIsLoading(false);

    }

  }, []);

  return {

    messages,
    sendMessage,
    isLoading

  };

}