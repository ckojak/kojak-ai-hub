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
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  const { user, loading: authLoading, profile } = useAuth();
  const { chats, currentChat, messages: dbMessages, createChat, selectChat, deleteChat, addMessage, updateChatTitle } = useChats();
  const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking } = useVoice();
  const { toast } = useToast();

  const messages = user && currentChat ? dbMessages : localMessages;

  // GATILHO DE VOZ AUTOMÁTICA
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant" && lastMessage.type === "text" && !isSpeaking && !isLoading) {
      const timer = setTimeout(() => {
        speak(lastMessage.content);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [messages, speak, isSpeaking, isLoading]);

  const handleNewChat = useCallback(async () => {
    if (user) await createChat(activeMode);
    setLocalMessages([]);
    setReferenceImage(null);
  }, [user, createChat, activeMode]);

  const handleSendMessage = useCallback(async (content: string, mode: string, imageUrl?: string) => {
    if (!content.trim() && !imageUrl && !referenceImage) return;

    let chatId = currentChat?.id;

    // Persistência no Banco (Kojak não perde dados)
    if (user) {
      if (!chatId) {
        const newChat = await createChat(mode);
        if (!newChat) {
          toast({ title: "Erro", description: "Não foi possível criar a conversa", variant: "destructive" });
          return;
        }
        chatId = newChat.id;
      }
      await addMessage("user", content, (imageUrl || referenceImage) ? "image" : "text", imageUrl || referenceImage);
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        chat_id: "local",
        role: "user",
        content,
        type: (imageUrl || referenceImage) ? "image" : "text",
        media_url: imageUrl || referenceImage || undefined,
        created_at: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      
      // MEMÓRIA: Mapeia as últimas 10 mensagens para contexto
      const messageHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const personalContext = profile?.personal_context || "";
      
      const { data, error } = await supabase.functions.invoke(config.function, {
        body: { 
          prompt: content,
          history: messageHistory, // Envia a memória
          context: personalContext, // Envia quem é o Kojak
          image: imageUrl, 
          reference_image: referenceImage 
        },
      });

      setReferenceImage(null);

      if (error) throw new Error(error.message);

      if (user && chatId) {
        await addMessage("assistant", data.content, data.type || "text", data.mediaUrl);
        if (dbMessages.length === 0) {
          await updateChatTitle(chatId, content.slice(0, 40));
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
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentChat, createChat, addMessage, updateChatTitle, messages, profile, toast, referenceImage]);

  if (authLoading) return <div className="h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Sidebar chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} onOpenSettings={() => setSettingsOpen(true)} />
      <MobileHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <main className="flex-1 relative overflow-hidden md:ml-72 transition-all duration-300">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          activeMode={activeMode}
          onModeChange={setActiveMode}
          onSendMessage={handleSendMessage}
          voiceTranscript={transcript}
          isListening={isListening}
          isSpeaking={isSpeaking}
          onStartListening={startListening}
          onStopListening={stopListening}
          onSpeak={speak}
          onStopSpeaking={stopSpeaking}
          referenceImage={referenceImage}
          onSelectReference={setReferenceImage}
          onClearReference={() => setReferenceImage(null)}
        />
      </main>
      
      <BottomBar activeMode={activeMode} onModeChange={setActiveMode} onOpenHistory={() => setHistoryOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
    </div>
  );
};

export default Index;
