import { useState, useEffect, useRef } from "react";
import { Send, Code2, Camera, Play, MessageCircle, Loader2, Mic, MicOff, Volume2, VolumeX, Paperclip, X, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (voiceTranscript) {
      setMessage(voiceTranscript);
    }
  }, [voiceTranscript]);

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

  const currentMode = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <div className="sticky bottom-0 p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto glass-card-strong rounded-2xl transition-all duration-300 hover:border-primary/30 neon-border">
        
        {/* NOVO: Visor da Imagem de Referência (Alvo) */}
        {referenceImage && (
          <div className="p-3 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3 h-3"/> Imagem Alvo (Referência)</span>
            </div>
            <div className="relative inline-block border-2 border-primary/50 rounded-lg overflow-hidden glow-purple">
              <img src={referenceImage} alt="Referência" className="h-20 w-auto object-cover" />
              <button type="button" onClick={onClearReference} className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center hover:scale-110">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Visor da Imagem Anexada (Fonte) */}
        {imagePreview && (
          <div className="p-3 border-b border-white/10">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
              <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/10">
          <span className="text-xs text-muted-foreground mr-2">Modo:</span>
          {modes.map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button key={mode.id} type="button" onClick={() => onModeChange(mode.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200", isActive ? "bg-primary/20 text-primary border border-primary/30 glow-purple" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}>
                <mode.icon className={cn("w-3.5 h-3.5", isActive && mode.color)} />
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-end gap-3 p-3">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", attachedImage ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground")}>
            {attachedImage ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
          </button>

          <button type="button" onClick={isListening ? onStopListening : onStartListening} disabled={isLoading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", isListening ? "bg-primary text-primary-foreground voice-pulse" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground")}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* AJUSTE DO ZOOM APLICADO: text-base no lugar de text-sm */}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Mensagem para Kojak ${currentMode.label}...`} className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed" rows={1} disabled={isLoading || isUploading} />

          {isSpeaking && (
            <button type="button" onClick={onStopSpeaking} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary animate-pulse">
              <VolumeX className="w-5 h-5" />
            </button>
          )}

          <button type="submit" disabled={(!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", (message.trim() || attachedImage || referenceImage) && !isLoading && !isUploading ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-105" : "bg-white/5 text-muted-foreground cursor-not-allowed")}>
            {isLoading || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
