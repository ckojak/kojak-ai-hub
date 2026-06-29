import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "code" | "image" | "video";
  media_url?: string;
  created_at: string;
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();

  // Fetch all chats for the current user
  const fetchChats = useCallback(async () => {
    if (!user) {
      setChats([]);
      return;
    }

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setChats(data);
    }
  }, [user]);

  // Fetch messages for a specific chat
  const fetchMessages = useCallback(async (chatId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
    setLoading(false);
  }, []);

  // Create a new chat
  const createChat = useCallback(async (mode: string = "chat") => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("chats")
      .insert({ 
        user_id: user.id,
        mode, 
        title: "Nova Conversa" 
      })
      .select()
      .single();

    if (!error && data) {
      setChats((prev) => [data, ...prev]);
      setCurrentChat(data);
      setMessages([]);
      return data;
    }
    return null;
  }, [user]);

  // Update chat title
  const updateChatTitle = useCallback(async (chatId: string, title: string) => {
    const { error } = await supabase
      .from("chats")
      .update({ title })
      .eq("id", chatId);

    if (!error) {
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat))
      );
      if (currentChat?.id === chatId) {
        setCurrentChat((prev) => (prev ? { ...prev, title } : null));
      }
    }
  }, [currentChat]);

  // Delete a chat
  const deleteChat = useCallback(async (chatId: string) => {
    const { error } = await supabase.from("chats").delete().eq("id", chatId);

    if (!error) {
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setMessages([]);
      }
    }
  }, [currentChat]);

  // Add a message to current chat
  const addMessage = useCallback(
    async (
      role: "user" | "assistant",
      content: string,
      type: "text" | "code" | "image" | "video" = "text",
      mediaUrl?: string
    ) => {
      if (!currentChat) return null;

      const { data, error } = await supabase
        .from("messages")
        .insert({
          chat_id: currentChat.id,
          role,
          content,
          type,
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => [...prev, data as Message]);

        // Update chat's updated_at
        await supabase
          .from("chats")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", currentChat.id);

        return data;
      }
      return null;
    },
    [currentChat]
  );

  // Select a chat
  const selectChat = useCallback(
    async (chat: Chat) => {
      setCurrentChat(chat);
      await fetchMessages(chat.id);
    },
    [fetchMessages]
  );

  // Fetch chats when user changes
  useEffect(() => {
    if (user) {
      fetchChats();
    } else {
      setChats([]);
      setCurrentChat(null);
      setMessages([]);
    }
  }, [user, fetchChats]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!currentChat) return;

    const channel = supabase
      .channel(`messages-${currentChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${currentChat.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChat]);

  return {
    chats,
    currentChat,
    messages,
    loading,
    createChat,
    selectChat,
    deleteChat,
    addMessage,
    updateChatTitle,
    setCurrentChat,
    setMessages,
  };
}
