import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { BottomBar } from "@/components/BottomBar";
import { MobileHistorySheet } from "@/components/MobileHistorySheet";
import { SettingsPanel } from "@/components/SettingsPanel";
import { KojakLive } from "@/components/KojakLive";
import { useChats, Message } from "@/hooks/useChats";
import { useVoice } from "@/hooks/useVoice";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const modeConfig: Record<string, { function: string; streams: boolean }> = {
  chat: { function: "kojak-code", streams: true },
  code: { function: "kojak-code", streams: true },
  vision: { function: "kojak-vision", streams: false },
  motion: { function: "kojak-motion", streams: false },
  saude: { function: "kojak-saude", streams: true },
};

const Index = () => {
  const [activeMode, setActiveMode] = useState("chat");
  const [aiTier, setAiTier] = useState<"basico" | "rapido" | "avancado" | "raciocinio">("rapido");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const { user, loading: authLoading, profile } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { chats, currentChat, messages: dbMessages, createChat, selectChat, deleteChat, addMessage, updateChatTitle } = useChats();
  const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking } = useVoice();
  const { toast } = useToast();

  const baseMessages = user && currentChat ? dbMessages : localMessages;
  const messages: Message[] = streamingContent
    ? [...baseMessages, {
        id: "streaming",
        chat_id: "streaming",
        role: "assistant",
        content: streamingContent,
        type: "text",
        created_at: new Date().toISOString(),
      }]
    : baseMessages;

  const logActivity = useCallback(async (action: string, details?: any) => {
    if (!user) return;
    await supabase.from("activity_log").insert({ user_id: user.id, action, details });
  }, [user]);

  const streamFromFunction = useCallback(async (fnName: string, payload: any): Promise<string> => {
    const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      try {
        const errJson = JSON.parse(errText);
        const err = new Error(errJson.error || `HTTP ${res.status}`) as Error & {
          requiresLogin?: boolean;
          upgradeRequired?: boolean;
        };
        err.requiresLogin = !!errJson.requiresLogin;
        err.upgradeRequired = !!errJson.upgradeRequired;
        throw err;
      } catch (parseErr) {
        if (parseErr instanceof Error && "requiresLogin" in parseErr) throw parseErr;
        throw new Error(errText || `HTTP ${res.status}`);
      }
    }

    if (!res.body) throw new Error("Resposta sem corpo");

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            full += delta;
            setStreamingContent(full);
          }
        } catch {
          /* ignore parse errors */
        }
      }
    }

    return full;
  }, []);

  const handleSendMessage = useCallback(async (content: string, mode: string, imageUrl?: string, options?: { webSearch?: boolean }) => {
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
      await addMessage("user", content, imageUrl ? "image" : "text", imageUrl, chatId);
      await logActivity(`Mensagem enviada no modo ${mode}`, { preview: content.slice(0, 100) });
    } else {
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
    setStreamingContent("");

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      const personalContext = profile?.personal_context || "";
      const recentHistory = baseMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

        const payload = {
      prompt: content,
      context: personalContext,
      history: recentHistory,
      image: imageUrl,
      reference_image: referenceImage,
      tier: aiTier,
      language,
      userId: user?.id ?? null,
      chatId: chatId ?? null,
      webSearch: !!options?.webSearch,
      };

      if (config.streams) {
        const fullText = await streamFromFunction(config.function, payload);
        setReferenceImage(null);

        const matches = [...fullText.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
        const responseType = matches.length > 0 ? "code" : "text";

        if (user && chatId) {
          await addMessage("assistant", fullText, responseType, undefined, chatId);
          if (dbMessages.length === 0) {
            const title = content ? content.slice(0, 50) + (content.length > 50 ? "..." : "") : "Nova Conversa";
            await updateChatTitle(chatId, title);
          }
        } else {
          setLocalMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            chat_id: "local",
            role: "assistant",
            content: fullText,
            type: responseType,
            created_at: new Date().toISOString(),
          }]);
        }
        setStreamingContent("");
      } else {
        // Non-streaming (Vision, Motion)
        const { data, error } = await supabase.functions.invoke(config.function, { body: payload });
        setReferenceImage(null);
        if (error) throw new Error(error.message || "Erro ao processar requisição");
        if (data.error) throw new Error(data.error);

        if (user && chatId) {
          await addMessage("assistant", data.content, data.type || "text", data.mediaUrl, chatId);
          if (dbMessages.length === 0) {
            const title = content ? content.slice(0, 50) + (content.length > 50 ? "..." : "") : "Imagem Enviada";
            await updateChatTitle(chatId, title);
          }
        } else {
          setLocalMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            chat_id: "local",
            role: "assistant",
            content: data.content,
            type: data.type || "text",
            media_url: data.mediaUrl,
            created_at: new Date().toISOString(),
          }]);
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const requiresLogin = error instanceof Error && (error as any).requiresLogin;
      const upgradeRequired = error instanceof Error && (error as any).upgradeRequired;

      toast({ title: upgradeRequired ? t("limitReachedTitle") : requiresLogin ? "Faça login para continuar" : "Erro", description: errorMessage, variant: "destructive" });
      setStreamingContent("");

      if (requiresLogin) {
        setTimeout(() => navigate("/auth"), 1200);
      }

      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        chat_id: chatId || "local",
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
        type: "text",
        created_at: new Date().toISOString(),
      };
      if (user && chatId) {
        await addMessage("assistant", errorAssistantMessage.content, "text", undefined, chatId);
      } else {
        setLocalMessages(prev => [...prev, errorAssistantMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentChat, createChat, addMessage, updateChatTitle, dbMessages, profile, toast, logActivity, referenceImage, localMessages.length, baseMessages, streamFromFunction, aiTier, language, navigate, t]);

  const handleNewChat = useCallback(async () => {
    if (user) await createChat(activeMode);
    setLocalMessages([]);
    setStreamingContent("");
  }, [user, createChat, activeMode]);

  const handleModeChange = useCallback((mode: string) => setActiveMode(mode), []);

  const handleOpenLive = useCallback(() => {
    if (!user) {
      toast({ title: "Faça login para continuar", description: "O Kojak Live exige login." });
      navigate("/auth");
      return;
    }
    setLiveOpen(true);
  }, [user, navigate, toast]);

  if (authLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Sidebar chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} onOpenSettings={() => setSettingsOpen(true)} onOpenLive={handleOpenLive} />
      <MobileHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} chats={chats} currentChatId={currentChat?.id} onSelectChat={selectChat} onNewChat={handleNewChat} onDeleteChat={deleteChat} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      {liveOpen && <KojakLive onClose={() => setLiveOpen(false)} />}

      <main className="flex-1 relative overflow-hidden md:ml-72 transition-all duration-300">
        <ChatArea
          messages={messages}
          isLoading={isLoading && !streamingContent}
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
          referenceImage={referenceImage}
          onSelectReference={setReferenceImage}
          onClearReference={() => setReferenceImage(null)}
          aiTier={aiTier}
          onTierChange={setAiTier}
          isLoggedIn={!!user}
          onRequireLogin={() => {
            toast({ title: "Faça login para continuar", description: "Esse modo exige login. Redirecionando..." });
            setTimeout(() => navigate("/auth"), 800);
          }}
        />
      </main>

      <BottomBar activeMode={activeMode} onModeChange={handleModeChange} onOpenHistory={() => setHistoryOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onOpenLive={handleOpenLive} />
    </div>
  );
};

export default Index;