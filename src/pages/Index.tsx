import { useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { BottomBar } from "@/components/BottomBar";
import { MobileHistorySheet } from "@/components/MobileHistorySheet";
import { useChats, Message } from "@/hooks/useChats";
import { useVoice } from "@/hooks/useVoice";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const modeConfig: Record<string, { function: string }> = {
  chat: { function: "kojak-code" }, // Using code function for general chat with Gemini
  code: { function: "kojak-code" },
  vision: { function: "kojak-vision" },
  motion: { function: "kojak-motion" },
};

const Index = () => {
  const [activeMode, setActiveMode] = useState("chat");
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  const {
    chats,
    currentChat,
    messages: dbMessages,
    createChat,
    selectChat,
    deleteChat,
    addMessage,
    updateChatTitle,
  } = useChats();

  const {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice();

  const { toast } = useToast();

  // Use local messages if no chat is selected, otherwise use DB messages
  const messages = currentChat ? dbMessages : localMessages;

  const handleSendMessage = useCallback(async (content: string, mode: string) => {
    if (!content.trim()) return;

    // If no chat exists, create one
    let chatId = currentChat?.id;
    if (!chatId) {
      const newChat = await createChat(mode);
      if (!newChat) {
        toast({
          title: "Erro",
          description: "Não foi possível criar a conversa",
          variant: "destructive",
        });
        return;
      }
      chatId = newChat.id;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      chat_id: chatId,
      role: "user",
      content,
      type: "text",
      created_at: new Date().toISOString(),
    };

    if (currentChat) {
      await addMessage("user", content, "text");
    } else {
      setLocalMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      
      const { data, error } = await supabase.functions.invoke(config.function, {
        body: { prompt: content },
      });

      if (error) {
        throw new Error(error.message || "Erro ao processar requisição");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: data.id || (Date.now() + 1).toString(),
        chat_id: chatId,
        role: "assistant",
        content: data.content,
        type: data.type || "text",
        media_url: data.mediaUrl,
        created_at: new Date().toISOString(),
      };

      if (currentChat) {
        await addMessage(
          "assistant",
          data.content,
          data.type || "text",
          data.mediaUrl
        );

        // Update chat title based on first message
        if (dbMessages.length === 0) {
          const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
          await updateChatTitle(chatId, title);
        }
      } else {
        setLocalMessages(prev => [...prev, assistantMessage]);
      }

      // Auto-speak response if enabled (optional)
      // speak(data.content);

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });

      // Add error message
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        chat_id: chatId,
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
        type: "text",
        created_at: new Date().toISOString(),
      };

      if (currentChat) {
        await addMessage("assistant", errorAssistantMessage.content, "text");
      } else {
        setLocalMessages(prev => [...prev, errorAssistantMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentChat, createChat, addMessage, updateChatTitle, dbMessages, toast]);

  const handleNewChat = useCallback(async () => {
    await createChat(activeMode);
    setLocalMessages([]);
  }, [createChat, activeMode]);

  const handleModeChange = useCallback((mode: string) => {
    setActiveMode(mode);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar
        chats={chats}
        currentChatId={currentChat?.id}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
      />

      {/* Mobile History Sheet */}
      <MobileHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        chats={chats}
        currentChatId={currentChat?.id}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
      />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden md:ml-72 transition-all duration-300">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          activeMode={activeMode}
          onModeChange={handleModeChange}
          onSendMessage={handleSendMessage}
          voiceTranscript={transcript}
          isListening={isListening}
          isSpeaking={isSpeaking}
          onStartListening={startListening}
          onStopListening={stopListening}
          onSpeak={speak}
          onStopSpeaking={stopSpeaking}
        />
      </main>

      {/* Mobile Bottom Bar */}
      <BottomBar
        activeMode={activeMode}
        onModeChange={handleModeChange}
        onOpenHistory={() => setHistoryOpen(true)}
      />
    </div>
  );
};

export default Index;
