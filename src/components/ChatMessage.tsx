import { Download, Copy, Check, User, Sparkles, Volume2, ImagePlus } from "lucide-react";
import { useState, useCallback } from "react"; // Adicionado useCallback
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; // Importa remark-gfm para suporte a tabelas, listas de tarefas, etc.

// Define a interface para a mensagem de chat
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "code" | "image" | "video"; // Mais tipos podem ser adicionados
  language?: string; // Linguagem para blocos de código
  media_url?: string; // URL para mídias (imagem, vídeo)
  created_at?: string; // Timestamp da criação da mensagem
}

// Define as propriedades para o componente ChatMessage
interface ChatMessageProps {
  message: Message;
  onSpeak?: (text: string) => void; // Função para síntese de fala
  onSelectReference?: (url: string) => void; // Função para selecionar referência (ex: para troca de rosto)
}

/**
 * Componente funcional `ChatMessage` que exibe uma mensagem individual em um chat.
 * Adapta o layout e as ações com base no remetente (usuário ou assistente)
 * e no tipo de conteúdo (texto, imagem).
 */
export function ChatMessage({ message, onSpeak, onSelectReference }: ChatMessageProps) {
  // Estado para controlar se o texto foi copiado
  const [copied, setCopied] = useState(false);
  // Verifica se a mensagem foi enviada pelo usuário
  const isUser = message.role === "user";

  /**
   * Lida com a ação de copiar o conteúdo da mensagem para a área de transferência.
   * Utiliza `useCallback` para memorizar a função e evitar recriações desnecessárias.
   * @param text O texto a ser copiado.
   */
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reseta o estado "copiado" após 2 segundos
    } catch (error) {
      console.error("Erro ao copiar para a área de transferência:", error);
      // Opcional: exiba uma mensagem de erro para o usuário
    }
  }, []);

  /**
   * Lida com o download de arquivos a partir de uma URL.
   * Utiliza `useCallback` para memorizar a função.
   * @param url A URL do arquivo a ser baixado.
   * @param filename O nome do arquivo para o download.
   */
  const handleDownload = useCallback(async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename; // Define o nome do arquivo para download
      document.body.appendChild(link);
      link.click(); // Simula um clique para iniciar o download
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl); // Libera o URL do objeto
    } catch (error) {
      console.error("Falha no download:", error);
      // Opcional: exiba uma mensagem de erro para o usuário
    }
  }, []);

  /**
   * Formata a timestamp da mensagem para exibição.
   * @returns A hora formatada (ex: "14:30").
   */
  const formatTime = useCallback(() => {
    // Se message.created_at existir, usa-o; caso contrário, usa o tempo atual
    const date = message.created_at ? new Date(message.created_at) : new Date();
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }, [message.created_at]);

  // Condição para renderizar o ReactMarkdown: se o conteúdo existir e não estiver vazio.
  // Isso garante que mesmo mensagens de imagem podem ter uma descrição de texto.
  const shouldRenderText = message.content && message.content.trim().length > 0;

  return (
    <div className={cn("flex gap-3 animate-fade-in", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar do usuário/assistente */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
        isUser ? "bg-gradient-purple glow-purple" : "bg-gradient-to-br from-primary/40 to-secondary/30 border border-primary/30"
      )}>
        {isUser ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-primary" />}
      </div>

      {/* Container do conteúdo da mensagem */}
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3",
        // Classes adaptadas para bolha de chat
        isUser ? "bubble-user text-white rounded-tr-sm" : "bubble-ai rounded-tl-sm"
      )}>
        
        {/* Renderiza o conteúdo de texto formatado com ReactMarkdown */}
        {shouldRenderText && (
          <div className={cn(
            "text-sm leading-relaxed prose prose-sm max-w-none", // Estilos base para tipografia
            { "mb-2": message.type === "image" }, // Adiciona margem inferior se houver imagem logo abaixo
            isUser ? "prose-invert" : "prose-kojak" // Temas para dark/light mode ou usuário/assistente
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Renderiza o conteúdo de imagem se o tipo for "image" e houver media_url */}
        {message.type === "image" && message.media_url && (
          <div className="relative group rounded-xl overflow-hidden mt-2"> {/* Adicionado mt-2 para espaçamento */}
            <img src={message.media_url} alt="Conteúdo multimídia" className="w-full max-w-md rounded-xl" />
            
            {/* Overlay com botões de ação para imagens do assistente */}
            {!isUser && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                {/* Botão de Download */}
                <button
                  onClick={() => handleDownload(message.media_url!, "kojak-image.png")}
                  className="p-3 bg-white/20 text-white rounded-full hover:scale-110 transition-transform backdrop-blur-sm"
                  title="Baixar imagem"
                >
                  <Download className="w-5 h-5" />
                </button>
                
                {/* Botão para "Usar como Alvo" (referência para outras operações) */}
                {onSelectReference && (
                  <button 
                    onClick={() => onSelectReference(message.media_url!)} 
                    className="p-3 bg-gradient-purple text-white rounded-full hover:scale-110 transition-transform glow-purple"
                    title="Usar como Alvo (Troca de Rosto ou similar)"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Ações para mensagens de texto do assistente (Copiar, Ouvir) */}
        {/* Só exibe se não for usuário, não for imagem e tiver algum conteúdo de texto */}
        {!isUser && message.type !== "image" && shouldRenderText && (
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/10">
                {/* Botão de Copiar */}
                <button
                  onClick={() => handleCopy(message.content)}
                  className="flex items-center gap-1.5 text-[10px] uppercase font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                </button>
                
                {/* Botão de Ouvir (Text-to-Speech) */}
                {onSpeak && (
                    <button
                      onClick={() => onSpeak(message.content)}
                      className="flex items-center gap-1.5 text-[10px] uppercase font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                        <Volume2 className="w-3.5 h-3.5" />
                        Ouvir
                    </button>
                )}
            </div>
        )}

        {/* Timestamp da mensagem */}
        <div className={cn("mt-2 text-[10px] font-medium opacity-50", isUser ? "text-right" : "text-left")}>
          {formatTime()}
        </div>
      </div>
    </div>
  );
}