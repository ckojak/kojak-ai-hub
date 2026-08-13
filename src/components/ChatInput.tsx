import { useState, useEffect, useRef } from "react";
import {
  Send, Code2, Camera, Play, MessageCircle, Loader2, Mic, MicOff, VolumeX,
  Plus, X, Image as ImageIcon, Sparkles, ChevronDown, Check, FileText, AudioLines, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import {
  extractDocumentText, transcribeAudio, DOC_ACCEPT, IMAGE_ACCEPT, AUDIO_ACCEPT,
} from "@/lib/attachments";

const TIER_OPTIONS = [
  { id: "basico" as const, label: "tierBasico", desc: "tierBasicoDesc", emoji: "🟢", locked: false },
  { id: "rapido" as const, label: "tierRapido", desc: "tierRapidoDesc", emoji: "⚡", locked: false },
  { id: "avancado" as const, label: "tierAvancado", desc: "tierAvancadoDesc", emoji: "🚀", locked: true },
  { id: "raciocinio" as const, label: "tierRaciocinio", desc: "tierRaciocinioDesc", emoji: "🧠", locked: true },
];

/** Máximo de imagens por envio (Vision aceita várias pra compor/combinar). */
const MAX_IMAGES = 10;
/** Lado maior após compressão — suficiente pra qualidade e rápido de enviar. */
const MAX_DIMENSION = 2048;
/** Qualidade do JPEG comprimido. */
const JPEG_QUALITY = 0.85;

interface ChatInputProps {
  onSend: (message: string, mode: string, imageUrls?: string[], options?: { webSearch?: boolean }) => void;
  isLoading?: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;
  referenceImage?: string | null;
  onClearReference?: () => void;
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

interface TextAttachment {
  kind: "document" | "audio";
  name: string;
  text: string;
}

/** Redimensiona/comprime uma imagem no navegador antes de subir. Isso evita
 * falha de envio com fotos de celular (que costumam vir com 8-15MB) sem
 * perder qualidade perceptível — o Nano Banana não precisa do arquivo
 * original gigante, só de resolução suficiente. */
async function compressImage(file: File): Promise<File> {
  // GIFs e imagens já pequenas não precisam de recompressão.
  if (file.type === "image/gif" || file.size < 900 * 1024) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const tierMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [textAttachment, setTextAttachment] = useState<TextAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  useEffect(() => {
    if (voiceTranscript) setMessage(voiceTranscript);
  }, [voiceTranscript]);

  useEffect(() => {
    if (!tierMenuOpen && !attachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) setTierMenuOpen(false);
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setAttachMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tierMenuOpen, attachMenuOpen]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (files.length === 0) return;

    const invalid = files.find((f) => !f.type.startsWith("image/"));
    if (invalid) {
      toast({ title: "Arquivo inválido", description: "Selecione apenas imagens.", variant: "destructive" });
      return;
    }

    const room = MAX_IMAGES - attachedImages.length;
    if (room <= 0) {
      toast({ title: "Limite de imagens", description: `Você pode enviar no máximo ${MAX_IMAGES} imagens por vez.`, variant: "destructive" });
      return;
    }
    const toAdd = files.slice(0, room);
    if (files.length > room) {
      toast({ title: "Limite de imagens", description: `Só cabem mais ${room}. As demais foram ignoradas.` });
    }

    setCompressing(true);
    try {
      const compressed = await Promise.all(toAdd.map(compressImage));

      // Ainda gigante mesmo após comprimir (raro): recusa só essa.
      const tooBig = compressed.filter((f) => f.size > 10 * 1024 * 1024);
      const ok = compressed.filter((f) => f.size <= 10 * 1024 * 1024);
      if (tooBig.length > 0) {
        toast({ title: "Imagem muito grande", description: `${tooBig.length} imagem(ns) não puderam ser reduzidas o suficiente e foram ignoradas.`, variant: "destructive" });
      }
      if (ok.length === 0) return;

      const newPreviews = await Promise.all(
        ok.map((file) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        })),
      );

      setAttachedImages((prev) => [...prev, ...ok]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    } finally {
      setCompressing(false);
    }
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (docInputRef.current) docInputRef.current.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 15MB.", variant: "destructive" });
      return;
    }
    setProcessing(t("readingFile"));
    try {
      const text = await extractDocumentText(file);
      setTextAttachment({ kind: "document", name: file.name, text });
    } catch (err) {
      toast({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : "Falha ao ler o documento.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 20MB.", variant: "destructive" });
      return;
    }
    setProcessing(t("transcribing"));
    try {
      const text = await transcribeAudio(file, language);
      setTextAttachment({ kind: "audio", name: file.name, text });
    } catch (err) {
      toast({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : "Falha ao transcrever o áudio.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setAttachedImages([]);
    setImagePreviews([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id || "anonymous"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

      const { data, error } = await supabase.storage.from("chat-attachments").upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
      return publicUrl;
    } catch (error) {
      console.error("Failed to upload image:", error);
      return null;
    }
  };

  const hasContent = !!(message.trim() || attachedImages.length > 0 || referenceImage || textAttachment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent || isLoading || isUploading || processing || compressing) return;

    let imageUrls: string[] | undefined;

    if (attachedImages.length > 0) {
      setIsUploading(true);
      const uploaded = await Promise.all(attachedImages.map(uploadImage));
      setIsUploading(false);
      const failed = uploaded.filter((u) => !u).length;
      if (failed > 0) {
        toast({ title: "Erro no upload", description: `${failed} imagem(ns) não puderam ser enviadas. Tente novamente.`, variant: "destructive" });
      }
      imageUrls = uploaded.filter((u): u is string => !!u);
      if (imageUrls.length === 0) return;
    }

    let finalMessage = message.trim();
    if (textAttachment) {
      const header = textAttachment.kind === "audio"
        ? `Transcrição do áudio "${textAttachment.name}"`
        : `Conteúdo do documento "${textAttachment.name}"`;
      finalMessage = `${finalMessage ? finalMessage + "\n\n" : ""}${header}:\n"""\n${textAttachment.text}\n"""`;
    }

    onSend(finalMessage, activeMode, imageUrls, { webSearch });
    setMessage("");
    setTextAttachment(null);
    clearAllImages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const attachOptions = [
    { id: "image", label: t("attachImage"), icon: ImageIcon, onClick: () => imageInputRef.current?.click() },
    { id: "document", label: t("attachDocument"), icon: FileText, onClick: () => docInputRef.current?.click() },
    { id: "audio", label: t("attachAudio"), icon: AudioLines, onClick: () => audioInputRef.current?.click() },
  ];

  return (
    <div className="sticky bottom-0 p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto glass-card-strong rounded-2xl transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_28px_-12px_hsl(var(--primary)/0.55)] focus-within:border-primary/40 neon-border"
      >
        {/* Visor da Imagem de Referência (Alvo) */}
        {referenceImage && (
          <div className="p-3 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3 h-3" /> {t("referenceImage")}</span>
            </div>
            <div className="relative inline-block border-2 border-primary/50 rounded-lg overflow-hidden glow-purple">
              <img src={referenceImage} alt={t("referenceImage")} className="h-20 w-auto object-cover" />
              <button type="button" onClick={onClearReference} aria-label={t("close")} className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Imagens anexadas (até 10) */}
        {(imagePreviews.length > 0 || compressing) && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {imagePreviews.length}/{MAX_IMAGES} imagens
              </span>
              {imagePreviews.length > 0 && (
                <button type="button" onClick={clearAllImages} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Limpar tudo
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`Anexo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-border" />
                  <button type="button" onClick={() => removeImage(i)} aria-label={t("close")} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {compressing && (
                <div className="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documento / áudio anexado (texto extraído) */}
        {textAttachment && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 animate-scale-in">
              {textAttachment.kind === "audio"
                ? <AudioLines className="w-4 h-4 text-primary flex-shrink-0" />
                : <FileText className="w-4 h-4 text-primary flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{textAttachment.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {textAttachment.kind === "audio" ? t("attachedAudio") : t("attachedDocument")} · {textAttachment.text.length} chars
                </p>
              </div>
              <button type="button" onClick={() => setTextAttachment(null)} aria-label={t("close")} className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
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
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-r from-primary/25 to-primary/5 text-primary border border-primary/30 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.8)]"
                      : "text-muted-foreground border border-transparent hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <mode.icon className={cn("w-3.5 h-3.5 transition-transform duration-300", isActive && mode.color)} />
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
                className="absolute right-0 bottom-full mb-2 z-30 w-64 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
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

        <div className="flex items-end gap-2 p-3">
          <input ref={imageInputRef} type="file" accept={IMAGE_ACCEPT} multiple onChange={handleImageSelect} className="hidden" />
          <input ref={docInputRef} type="file" accept={DOC_ACCEPT} onChange={handleDocSelect} className="hidden" />
          <input ref={audioInputRef} type="file" accept={AUDIO_ACCEPT} onChange={handleAudioSelect} className="hidden" />

          {/* Botão + com menu de anexos */}
          <div className="relative flex-shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              disabled={isLoading || isUploading || !!processing}
              aria-haspopup="menu"
              aria-expanded={attachMenuOpen}
              aria-label={t("attachMenu")}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300",
                attachedImages.length > 0 || textAttachment
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
              )}
            >
              {processing || compressing
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Plus className={cn("w-5 h-5 transition-transform duration-300", attachMenuOpen && "rotate-45")} />}
            </button>

            {attachMenuOpen && (
              <div role="menu" className="absolute left-0 bottom-full mb-2 z-30 w-60 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
                <p className="px-3 pt-3 pb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{t("attachMenu")}</p>
                {attachOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { setAttachMenuOpen(false); opt.onClick(); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm hover:bg-foreground/5 transition-colors"
                  >
                    <opt.icon className="w-4 h-4 text-primary" />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle de busca na web */}
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            disabled={isLoading}
            aria-pressed={webSearch}
            aria-label={t("webSearch")}
            title={t("webSearch")}
            className={cn(
              "flex-shrink-0 h-10 flex items-center gap-1.5 px-2.5 rounded-xl transition-all duration-300 border",
              webSearch
                ? "bg-gradient-to-r from-primary/25 to-primary/5 text-primary border-primary/40 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.8)]"
                : "bg-foreground/5 text-muted-foreground border-transparent hover:bg-foreground/10 hover:text-foreground",
            )}
          >
            <Globe className={cn("w-5 h-5", webSearch && "animate-pulse-slow")} />
            <span className="hidden sm:inline text-xs font-medium">{t("webSearch")}</span>
          </button>

          <button type="button" onClick={isListening ? onStopListening : onStartListening} disabled={isLoading} className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300", isListening ? "bg-primary text-primary-foreground voice-pulse" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground")}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={processing || t("typeMessage")}
            aria-label={t("typeMessage")}
            className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed"
            rows={1}
            disabled={isLoading || isUploading}
          />

          {isSpeaking && (
            <button type="button" onClick={onStopSpeaking} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary animate-pulse">
              <VolumeX className="w-5 h-5" />
            </button>
          )}

          <button
            type="submit"
            disabled={!hasContent || isLoading || isUploading || !!processing || compressing}
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300",
              hasContent && !isLoading && !isUploading && !processing && !compressing
                ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-110 active:scale-95"
                : "bg-foreground/5 text-muted-foreground cursor-not-allowed",
            )}
          >
            {isLoading || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
