import { useState, useCallback, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

import type { Message } from "@/components/ChatMessage";

interface SendMessagePayload {

  content: string;

  type?: "text" | "image";

  media_url?: string;

}

export function useChats() {

  const [messages, setMessages] = useState<Message[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [chatId, setChatId] = useState<string | null>(null);

  /*
  ---------------------------------------
  CREATE CHAT
  ---------------------------------------
  */

  const createChat = useCallback(async () => {

    try {

      const { data, error } = await supabase
        .from("chats")
        .insert({})
        .select()
        .single();

      if (error) throw error;

      setChatId(data.id);

    } catch (error) {

      console.error("Create chat error:", error);

    }

  }, []);

  /*
  ---------------------------------------
  LOAD MESSAGES
  ---------------------------------------
  */

  const loadMessages = useCallback(async (id: string) => {

    try {

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data || []);

    } catch (error) {

      console.error("Load messages error:", error);

    }

  }, []);

  /*
  ---------------------------------------
  INIT
  ---------------------------------------
  */

  useEffect(() => {

    createChat();

  }, [createChat]);

  useEffect(() => {

    if (chatId) {

      loadMessages(chatId);

    }

  }, [chatId, loadMessages]);

  /*
  ---------------------------------------
  SEND MESSAGE
  ---------------------------------------
  */

  const sendMessage = useCallback(async (payload: SendMessagePayload) => {

    if (!chatId) return;

    try {

      setIsLoading(true);

      const content = payload.content;

      /*
      USER MESSAGE LOCAL
      */

      const userMessage: Message = {

        id: crypto.randomUUID(),

        role: "user",

        content,

        type: payload.type || "text",

        media_url: payload.media_url,

      };

      setMessages(prev => [...prev, userMessage]);

      /*
      SAVE USER MESSAGE
      */

      await supabase.from("messages").insert({

        chat_id: chatId,

        role: "user",

        content,

        type: userMessage.type,

        media_url: userMessage.media_url,

      });

      /*
      CALL EDGE FUNCTION
      */

      const { data, error } = await supabase.functions.invoke("chat", {

        body: {

          message: content,

          chat_id: chatId,

        },

      });

      if (error) throw error;

      /*
      AI MESSAGE LOCAL
      */

      const aiMessage: Message = {

        id: crypto.randomUUID(),

        role: "assistant",

        content: data?.response || "Erro ao gerar resposta",

        type: "text",

      };

      setMessages(prev => [...prev, aiMessage]);

      /*
      SAVE AI MESSAGE
      */

      await supabase.from("messages").insert({

        chat_id: chatId,

        role: "assistant",

        content: aiMessage.content,

        type: "text",

      });

    } catch (error) {

      console.error("Send message error:", error);

    } finally {

      setIsLoading(false);

    }

  }, [chatId]);

  /*
  ---------------------------------------
  RETURN
  ---------------------------------------
  */

  return {

    messages,

    sendMessage,

    isLoading,

  };

}