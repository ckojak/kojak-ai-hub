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
  
  // <--- NOVO: Estado que guarda a foto Alvo (Jet Ski) --->
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  const { user, loading: authLoading, profile } = useAuth();
  
  const { chats, currentChat, messages: dbMessages, createChat, selectChat, deleteChat, addMessage, updateChatTitle } = useChats();
  const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking } = useVoice();
  const { toast } = useToast();

  const messages = user && currentChat ? dbMessages : localMessages;

  const logActivity = useCallback(async (action: string, details?: any) => {
    if (!user) return;
    await supabase.from("activity_log").insert({ user_id: user.id, action, details });
  }, [user]);

  const handleSendMessage = useCallback(async (content: string, mode: string, imageUrl?: string) => {
    if (!content.trim() && !imageUrl && !referenceImage) return;

    let chatId = currentChat?.id;

    if (user) {
      if (!chatId) {
        const newChat = await createChat(mode);
        if (!newChat) {
          toast({ title: "Erro", description: "Não foi possível criar a conversa", variant: "destructive" });
          return;
        }
        chatId = newChat.id;
      }
      await addMessage("user", content, imageUrl ? "image" : "text", imageUrl);
      await logActivity(`Mensagem enviada no modo ${mode}`, { preview: content.slice(0, 100) });
    } else {
      // Visitante: avisa uma vez que histórico só é salvo após login
      if (localMessages.length === 0) {
        toast({
          title: "Faça login para salvar suas conversas",
          description: "Sem login, esta conversa será perdida ao recarregar a página.",
        });
      }
      const userMessage: Message = {
        id: Date.now().toString(),
        chat_id: "local",
        role: "user",
        content,
        type: imageUrl ? "image" : "text",
        media_url: imageUrl,
        created_at: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      const personalContext = profile?.personal_context || "";

      // MEMÓRIA: últimas 10 mensagens já existentes (exclui a recém adicionada localmente)
      const recentHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke(config.function, {
        body: {
          prompt: content,
          context: personalContext,
          history: recentHistory,
          image: imageUrl,
          reference_image: referenceImage,
        },
      });

      // Limpa a referência depois que enviou com sucesso
      setReferenceImage(null);

      if (error) throw new Error(error.message || "Erro ao processar requisição");
      if (data.error) throw new Error(data.error);

      if (user && chatId) {
        await addMessage("assistant", data.content, data.type || "text", data.mediaUrl);
        if (dbMessages.length === 0) {
          const title = content ? (content.slice(0, 50) + (content.length > 50 ? "..." : "")) : "Imagem Enviada";
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
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });

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
  }, [user, currentChat, createChat, addMessage, updateChatTitle, dbMessages, profile, toast, logActivity, referenceImage]);

  const handleNewChat = useCallback(async () => {
    if (user) await createChat(activeMode);
    setLocalMessages([]);
  }, [user, createChat, activeMode]);

  const handleModeChange = useCallback((mode: string) => {
    setActiveMode(mode);
  }, []);

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
      <Sidebar chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} onOpenSettings={() => setSettingsOpen(true)} />
      <MobileHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

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
          // <--- NOVO: Repassando as props da imagem de referência --->
          referenceImage={referenceImage}
          onSelectReference={setReferenceImage}
          onClearReference={() => setReferenceImage(null)}
        />
      </main>

      <BottomBar activeMode={activeMode} onModeChange={handleModeChange} onOpenHistory={() => setHistoryOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
    </div>
  );
};

export default Index;
