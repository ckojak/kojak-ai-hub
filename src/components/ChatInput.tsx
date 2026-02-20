import { useState, useEffect, useRef } from "react";
import { Send, Code2, Camera, Play, MessageCircle, Loader2, Mic, MicOff, Volume2, VolumeX, Paperclip, X, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils"; // Função utilitária para combinar classes CSS condicionalmente
import { supabase } from "@/integrations/supabase/client"; // Cliente Supabase para interagir com o backend
import { useToast } from "@/hooks/use-toast"; // Hook para exibir notificações (toasts)

// --- Definições de Tipos ---

/**
 * Define a estrutura de dados para cada modo de chat.
 */
interface Mode {
  id: string;      // Identificador único do modo
  label: string;   // Nome visível do modo
  icon: React.ElementType; // Componente de ícone do modo (usando lucide-react)
  color: string;   // Classe CSS para a cor do ícone
}

/**
 * Define os dados que serão enviados ao submeter o formulário de chat.
 */
interface SendMessagePayload {
  message: string;          // O texto da mensagem
  mode: string;             // O modo de chat ativo
  imageUrl?: string;        // URL da imagem anexada (se houver)
  referenceImageUrl?: string; // URL da imagem de referência (se houver)
}

/**
 * Propriedades esperadas pelo componente ChatInput.
 */
interface ChatInputProps {
  onSend: (payload: SendMessagePayload) => void; // Função chamada ao enviar a mensagem
  isLoading?: boolean;                           // Indica se uma operação de envio está em andamento
  activeMode: string;                            // O modo de chat atualmente selecionado
  onModeChange: (mode: string) => void;          // Função para alterar o modo de chat
  voiceTranscript?: string;                      // Transcrição de voz (se disponível)
  isListening?: boolean;                         // Indica se o microfone está ouvindo
  isSpeaking?: boolean;                          // Indica se o assistente está falando
  onStartListening?: () => void;                 // Função para iniciar a escuta do microfone
  onStopListening?: () => void;                  // Função para parar a escuta do microfone
  onStopSpeaking?: () => void;                   // Função para parar a fala do assistente
  referenceImage?: string | null;                // URL da imagem de referência (contexto visual para o AI)
  onClearReference?: () => void;                 // Função para limpar a imagem de referência
}

// --- Definição dos Modos de Chat ---
const modes: Mode[] = [
  { id: "chat", label: "Chat", icon: MessageCircle, color: "text-emerald-400" },
  { id: "code", label: "Code", icon: Code2, color: "text-blue-400" },
  { id: "vision", label: "Vision", icon: Camera, color: "text-amber-400" },
  { id: "motion", label: "Motion", icon: Play, color: "text-rose-400" },
];

/**
 * Componente de entrada de chat que permite enviar mensagens, anexar imagens,
 * selecionar modos de chat e interagir com funcionalidades de voz.
 */
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
  // --- Estados Locais ---
  const [message, setMessage] = useState("");              // O texto atual da mensagem
  const [attachedImage, setAttachedImage] = useState<File | null>(null); // O arquivo de imagem anexado
  const [imagePreview, setImagePreview] = useState<string | null>(null);   // URL para pré-visualizar a imagem anexada
  const [isUploading, setIsUploading] = useState(false);                 // Indica se uma imagem está sendo enviada para o servidor
  
  const fileInputRef = useRef<HTMLInputElement>(null); // Referência para o input de arquivo (para acionar programaticamente)
  const { toast } = useToast();                        // Hook para exibir notificações

  // --- Efeitos ---
  /**
   * Atualiza o estado da mensagem quando uma transcrição de voz é fornecida.
   */
  useEffect(() => {
    if (voiceTranscript) {
      setMessage(voiceTranscript);
    }
  }, [voiceTranscript]);

  // --- Funções de Manipulação ---

  /**
   * Lida com a seleção de uma imagem através do input de arquivo.
   * Valida o tipo e o tamanho do arquivo antes de definir o estado.
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Remove qualquer imagem anexada anteriormente antes de processar a nova
    removeImage(); 

    // Validação de tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Por favor, selecione uma imagem.", variant: "destructive" });
      return;
    }

    // Validação de tamanho de arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    setAttachedImage(file); // Define o arquivo de imagem
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string); // Cria uma URL para pré-visualizar a imagem
    };
    reader.readAsDataURL(file); // Lê o arquivo como URL de dados
  };

  /**
   * Reseta os estados relacionados à imagem anexada, removendo a imagem.
   */
  const removeImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Limpa o valor do input de arquivo
    }
  };

  /**
   * Envia a imagem para o Supabase Storage.
   * @param file O arquivo de imagem a ser enviado.
   * @returns A URL pública da imagem após o upload, ou null se houver erro.
   */
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true); // Inicia o estado de upload
      const { data: { user } } = await supabase.auth.getUser(); // Obtém o usuário atual
      
      // Gera um nome de arquivo único para evitar colisões
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id || "anonymous"}/${Date.now()}.${fileExt}`;

      // Realiza o upload da imagem para o bucket 'chat-attachments'
      const { data, error } = await supabase.storage.from("chat-attachments").upload(fileName, file, {
        cacheControl: '3600', // Cache por 1 hora
        upsert: false // Não sobrescrever se o arquivo já existir
      });
      if (error) throw error;

      // Obtém a URL pública da imagem recém-enviada
      const { data: { publicUrl } } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
      return publicUrl;
    } catch (error) {
      console.error("Failed to upload image:", error);
      toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem. Tente novamente.", variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false); // Finaliza o estado de upload
    }
  };

  /**
   * Lida com o envio do formulário de chat.
   * Realiza o upload da imagem se houver uma, e então chama `onSend`.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previne o comportamento padrão de envio do formulário

    // Impede o envio se não houver mensagem, imagem ou imagem de referência, ou se estiver carregando/uploading
    if ((!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading) {
      return;
    }

    let imageUrl: string | undefined;

    // Se houver uma imagem anexada, faz o upload primeiro
    if (attachedImage) {
      const uploadedUrl = await uploadImage(attachedImage);
      if (!uploadedUrl) return; // Se o upload falhar, aborta o envio
      imageUrl = uploadedUrl;
    }

    // Prepara o payload para a função onSend
    const payload: SendMessagePayload = {
      message: message.trim(),
      mode: activeMode,
      imageUrl: imageUrl,
      referenceImageUrl: referenceImage || undefined,
    };

    onSend(payload); // Chama a função onSend com o payload
    setMessage("");     // Limpa a mensagem do input
    removeImage();      // Remove a imagem anexada e sua pré-visualização
  };

  /**
   * Lida com o evento de tecla pressionada no textarea.
   * Envia a mensagem ao pressionar Enter (sem Shift).
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Previne a quebra de linha padrão
      handleSubmit(e);    // Chama a função de envio
    }
  };

  const currentMode = modes.find((m) => m.id === activeMode) || modes[0]; // Encontra o modo ativo ou usa o primeiro como padrão

  // --- Renderização ---
  return (
    <div className="sticky bottom-0 p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent z-10"> {/* z-10 para garantir que o input fique por cima de outros elementos */}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto glass-card-strong rounded-2xl transition-all duration-300 hover:border-primary/30 neon-border">
        
        {/* Bloco para exibir Imagem de Referência (Alvo) */}
        {referenceImage && (
          <div className="p-3 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                 <Sparkles className="w-3 h-3"/> Imagem Alvo (Referência)
               </span>
            </div>
            <div className="relative inline-block border-2 border-primary/50 rounded-lg overflow-hidden glow-purple">
              <img src={referenceImage} alt="Imagem de Referência" className="h-20 w-auto object-cover" />
              <button 
                type="button" 
                onClick={onClearReference} 
                className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                aria-label="Remover imagem de referência"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Bloco para exibir Imagem Anexada (Fonte) */}
        {imagePreview && (
          <div className="p-3 border-b border-white/10">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Pré-visualização da imagem anexada" className="h-20 w-auto rounded-lg object-cover" />
              <button 
                type="button" 
                onClick={removeImage} 
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                aria-label="Remover imagem anexada"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Seleção de Modos (apenas em telas maiores) */}
        <div className="hidden md:flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/10">
          <span className="text-xs text-muted-foreground mr-2">Modo:</span>
          {modes.map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button 
                key={mode.id} 
                type="button" 
                onClick={() => onModeChange(mode.id)} 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200", 
                  isActive ? "bg-primary/20 text-primary border border-primary/30 glow-purple" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
                aria-pressed={isActive} // Indica se o botão está pressionado
                aria-label={`Selecionar modo ${mode.label}`}
              >
                <mode.icon className={cn("w-3.5 h-3.5", isActive && mode.color)} />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Área Principal de Input */}
        <div className="flex items-end gap-3 p-3">
          {/* Input de Arquivo (oculto) */}
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/*" 
            onChange={handleImageSelect} 
            className="hidden" 
            aria-label="Anexar imagem"
          />
          
          {/* Botão para Anexar Imagem */}
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isLoading || isUploading} 
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", 
              attachedImage ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            )}
            aria-label={attachedImage ? "Imagem anexada" : "Anexar imagem"}
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : attachedImage ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
          </button>

          {/* Botão de Gravação de Áudio */}
          <button 
            type="button" 
            onClick={isListening ? onStopListening : onStartListening} 
            disabled={isLoading} 
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", 
              isListening ? "bg-primary text-primary-foreground voice-pulse" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            )}
            aria-label={isListening ? "Parar de ouvir" : "Iniciar gravação de áudio"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Textarea para a Mensagem */}
          <textarea 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
            onKeyDown={handleKeyDown} 
            placeholder={`Mensagem para Kojak ${currentMode.label}...`} 
            className="flex-1 min-h-[44px] max-h-32 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed" 
            rows={1} 
            disabled={isLoading || isUploading} 
            aria-label={`Campo de mensagem para o modo ${currentMode.label}`}
          />

          {/* Botão para Parar a Fala do Assistente (Text-to-Speech) */}
          {isSpeaking && (
            <button 
              type="button" 
              onClick={onStopSpeaking} 
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary animate-pulse"
              aria-label="Parar fala do assistente"
            >
              <VolumeX className="w-5 h-5" />
            </button>
          )}

          {/* Botão de Envio */}
          <button 
            type="submit" 
            disabled={(!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading} 
            className={cn(
              "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200", 
              (message.trim() || attachedImage || referenceImage) && !isLoading && !isUploading ? "bg-gradient-purple text-primary-foreground glow-purple hover:scale-105" : "bg-white/5 text-muted-foreground cursor-not-allowed"
            )}
            aria-label="Enviar mensagem"
          >
            {isLoading || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}