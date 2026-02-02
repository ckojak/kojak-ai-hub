import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { BottomBar } from "@/components/BottomBar";
import { MobileHistorySheet } from "@/components/MobileHistorySheet";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useChats, Message } from "@/hooks/useChats";
import { useVoice } from "@/hooks/useVoice";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const modeConfig: Record<string, { function: string }> = {
  chat: { function: "kojak-code" },
  code: { function: "kojak-code" },
  vision: { function: "kojak-vision" },
  motion: { function: "kojak-motion" },
};

const Index = () => {
  const [activeMode, setActiveMode] = useState("chat");
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  const { user, loading: authLoading, profile } = useAuth();
  
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

  // Use DB messages if authenticated and has a chat, otherwise use local
  const messages = user && currentChat ? dbMessages : localMessages;

  // Log activity when sending messages
  const logActivity = useCallback(async (action: string, details?: any) => {
    if (!user) return;
    
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action,
      details,
    });
  }, [user]);

  const handleSendMessage = useCallback(async (content: string, mode: string, imageUrl?: string) => {
    if (!content.trim()) return;

    let chatId = currentChat?.id;

    // If authenticated, create chat in DB
    if (user) {
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

      // Add user message to DB
      await addMessage("user", content, "text");
      
      // Log activity
      await logActivity(`Mensagem enviada no modo ${mode}`, { preview: content.slice(0, 100) });
    } else {
      // Add to local state for non-authenticated users
      const userMessage: Message = {
        id: Date.now().toString(),
        chat_id: "local",
        role: "user",
        content,
        type: "text",
        created_at: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      
      // Include personal context if available
      const personalContext = profile?.personal_context || "";
      const promptWithContext = personalContext 
        ? `[Contexto do usuário: ${personalContext}]\n\n${content}`
        : content;
      
      const { data, error } = await supabase.functions.invoke(config.function, {
        body: { prompt: promptWithContext, image: imageUrl },
      });

      if (error) {
        throw new Error(error.message || "Erro ao processar requisição");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant message
      if (user && chatId) {
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
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          chat_id: "local",
          role: "assistant",
          content: data.content,
          type: data.type || "text",
          media_url: data.mediaUrl,
          created_at: new Date().toISOString(),
        };
        setLocalMessages(prev => [...prev, assistantMessage]);
      }

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
        chat_id: chatId || "local",
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
        type: "text",
        created_at: new Date().toISOString(),
      };

      if (user && chatId) {
        await addMessage("assistant", errorAssistantMessage.content, "text");
      } else {
        setLocalMessages(prev => [...prev, errorAssistantMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentChat, createChat, addMessage, updateChatTitle, dbMessages, profile, toast, logActivity]);

  const handleNewChat = useCallback(async () => {
    if (user) {
      await createChat(activeMode);
    }
    setLocalMessages([]);
  }, [user, createChat, activeMode]);

  const handleModeChange = useCallback((mode: string) => {
    setActiveMode(mode);
  }, []);

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar
        chats={chats}
        currentChatId={currentChat?.id}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
        onOpenSettings={() => setSettingsOpen(true)}
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

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
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
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
};

export default Index;
