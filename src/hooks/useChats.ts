import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/components/ChatMessage";
import { SendMessagePayload } from "@/components/ChatInput";

export function useChats() {

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (payload: SendMessagePayload) => {

    if (!payload.content && !payload.imageFile) return;

    setIsLoading(true);

    try {

      // cria mensagem do usuário
      const userMessage: Message = {

        id: crypto.randomUUID(),
        role: "user",
        content: payload.content || "",
        type: payload.imageFile ? "image" : "text",
        media_url: payload.imageFile
          ? URL.createObjectURL(payload.imageFile)
          : undefined,

        created_at: new Date().toISOString()

      };

      setMessages(prev => [...prev, userMessage]);

      // chama edge function kojak
      const { data, error } = await supabase.functions.invoke("kojak-code", {

        body: {
          message: payload.content
        }

      });

      if (error) throw error;

      const aiMessage: Message = {

        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Resposta vazia",
        created_at: new Date().toISOString()

      };

      setMessages(prev => [...prev, aiMessage]);

    }
    catch (err) {

      console.error("Erro ao enviar:", err);

      const errorMessage: Message = {

        id: crypto.randomUUID(),
        role: "assistant",
        content: "Erro ao processar mensagem.",
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