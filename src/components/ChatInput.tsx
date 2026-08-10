import { useState, useEffect, useRef } from "react";
import { Send, Code2, Camera, Play, MessageCircle, Loader2, Mic, MicOff, VolumeX, Paperclip, X, Image as ImageIcon, Sparkles, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";

const TIER_OPTIONS = [
  { id: "basico" as const, label: "tierBasico", desc: "tierBasicoDesc", emoji: "🟢", locked: false },
  { id: "rapido" as const, label: "tierRapido", desc: "tierRapidoDesc", emoji: "⚡", locked: false },
  { id: "avancado" as const, label: "tierAvancado", desc: "tierAvancadoDesc", emoji: "🚀", locked: true },
  { id: "raciocinio" as const, label: "tierRaciocinio", desc: "tierRaciocinioDesc", emoji: "🧠", locked: true },
];

interface ChatInputProps {
  onSend: (message: string, mode: string, imageUrl?: string) => void;
  isLoading?: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;
  referenceImage?: string | null; // <--- NOVO: Recebe a imagem alvo
  onClearReference?: () => void;  // <--- NOVO: Função para limpar a imagem alvo
  aiTier?: "basico" | "rapido" | "avancado" | "raciocinio";
  onTierChange?: (tier: "basico" | "rapido" | "avancado" | "raciocinio") => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
}

const modes = [
  { id: "chat", label: "Chat", icon: MessageCircle, color: "text-emerald-400" },
  { id: "code", label: "Code", icon: Code2, color: "text-blue-400" },
  { id: "vision", label: "Vision", icon: Camera, color: "text-amber-400" },
  { id: "motion", label: "Motion", icon: Play, color: "text-rose-400" },
];

export function ChatInput({ 
  onSend, 
  isLoading, 
  activeMode, 
  onModeChange,
  voiceTranscript,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  referenceImage,
  onClearReference,
  aiTier = "basico",
  onTierChange,
  isLoggedIn = false,
  onRequireLogin,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const tierMenuRef = useRef<HTMLDivElement>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (voiceTranscript) {
      setMessage(voiceTranscript);
    }
  }, [voiceTranscript]);

  useEffect(() => {
    if (!tierMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) {
        setTierMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tierMenuOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Por favor, selecione uma imagem.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    setAttachedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id || "anonymous"}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage.from("chat-attachments").upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
      return publicUrl;
    } catch (error) {
      console.error("Failed to upload image:", error);
      toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem. Tente novamente.", variant: "destructive" });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading) return;

    let imageUrl: string | undefined;

    if (attachedImage) {
      setIsUploading(true);
      const uploadedUrl = await uploadImage(attachedImage);
      setIsUploading(false);
      if (!uploadedUrl) return;
      imageUrl = uploadedUrl;
    }

    onSend(message.trim(), activeMode, imageUrl);
    setMessage("");
    removeImage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };



  return (
    <div className="sticky bottom-0 p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto glass-card-strong rounded-2xl transition-all duration-300 hover:border-primary/30 neon-border">
        
        {/* Visor da Imagem de Referência (Alvo) */}
        {referenceImage && (
          <div className="p-3 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3 h-3"/> {t("referenceImage")}</span>
            </div>
            <div className="relative inline-block border-2 border-primary/50 rounded-lg overflow-hidden glow-purple">
              <img src={referenceImage} alt={t("referenceImage")} className="h-20 w-auto object-cover" />
              <button type="button" onClick={onClearReference} aria-label={t("close")} className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Visor da Imagem Anexada (Fonte) */}
        {imagePreview && (
          <div className="p-3 border-b border-border">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
              <button type="button" onClick={removeImage} aria-label={t("close")} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Barra superior: modo ativo (desktop) + seletor de inteligência */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-border">
          <div className="hidden md:flex items-center gap-1 min-w-0">
            {modes.map((mode) => {
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onModeChange(mode.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground border border-transparent hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <mode.icon className={cn("w-3.5 h-3.5", isActive && mode.color)} />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className="relative ml-auto" ref={tierMenuRef}>
            <button
              type="button"
              onClick={() => setTierMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={tierMenuOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <span aria-hidden>{TIER_OPTIONS.find((o) => o.id === aiTier)?.emoji}</span>
              <span className="text-foreground">{t(TIER_OPTIONS.find((o) => o.id === aiTier)?.label || "tierRapido")}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tierMenuOpen && "rotate-180")} />
            </button>

            {tierMenuOpen && (
              <div
                role="listbox"
                className="absolute right-0 bottom-full mb-2 z-30 w-64 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
              >
                <p className="px-3 pt-3 pb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{t("aiMode")}</p>
                {TIER_OPTIONS.map((option) => {
                  const isActive = aiTier === option.id;
                  const isBlocked = option.locked && !isLoggedIn;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setTierMenuOpen(false);
                        if (isBlocked) { onRequireLogin?.(); return; }
                        onTierChange?.(option.id);
                      }}
                      className={cn(
                        "flex items-start gap-2.5 w-full px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-primary/10" : "hover:bg-foreground/5",
                        isBlocked && "opacity-60",
                      )}
                    >
                      <span className="mt-0.5" aria-hidden>{option.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className={cn("block text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>
                          {t(option.label)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground leading-snug">{t(option.desc)}</span>
                      </span>
                      {isBlocked
                        ? <span className="text-[10px] mt-1 text-muted-foreground">🔒 {t("requiresLogin")}</span>
                        : isActive && <Check className="w-4 h-4 text-primary mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>


        <div className="flex items-end gap-3 p-3">
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.gif" onChange={handleImageSelect} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", attachedImage ? "bg-primary/20 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground")}>
            {attachedImage ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
          </button>

          <button type="button" onClick={isListening ? onStopListening : onStartListening} disabled={isLoading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", isListening ? "bg-primary text-primary-foreground voice-pulse" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground")}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* AJUSTE DO ZOOM APLICADO: text-base no lugar de text-sm */}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder={`${t("typeMessage")}`} aria-label={t("typeMessage")} className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed" rows={1} disabled={isLoading || isUploading} />

          {isSpeaking && (
            <button type="button" onClick={onStopSpeaking} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary animate-pulse">
              <VolumeX className="w-5 h-5" />
            </button>
          )}

          <button type="submit" disabled={(!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", (message.trim() || attachedImage || referenceImage) && !isLoading && !isUploading ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-105" : "bg-foreground/5 text-muted-foreground cursor-not-allowed")}>
            {isLoading || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}