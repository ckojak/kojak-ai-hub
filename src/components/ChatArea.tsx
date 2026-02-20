import { useRef, useEffect } from "react"; // Importa hooks necessários do React
import { ChatMessage, Message } from "./ChatMessage"; // Componente para exibir uma única mensagem
import { ChatInput } from "./ChatInput"; // Componente para a entrada do usuário
import { TypingIndicator } from "./TypingIndicator"; // Componente para indicar digitação
import { Sparkles, Code2, Camera, Play, MessageCircle } from "lucide-react"; // Ícones do Lucide React
import { cn } from "@/lib/utils"; // Função utilitária para combinar classes CSS

// Define a interface para as propriedades do ChatArea
interface ChatAreaProps {
  messages: Message[]; // Array de objetos Message a serem exibidos
  isLoading: boolean; // Indica se a IA está processando uma resposta
  activeMode: string; // O modo de interação ativo (e.g., 'chat', 'code', 'vision')
  onModeChange: (mode: string) => void; // Callback para quando o modo é alterado
  onSendMessage: (content: string, mode: string, imageUrl?: string) => void; // Callback para enviar uma mensagem
  voiceTranscript?: string; // Transcrição de voz atual (se houver)
  isListening?: boolean; // Indica se a escuta de voz está ativa
  isSpeaking?: boolean; // Indica se a IA está falando
  onStartListening?: () => void; // Callback para iniciar a escuta de voz
  onStopListening?: () => void; // Callback para parar a escuta de voz
  onSpeak?: (text: string) => void; // Callback para a IA falar um texto
  onStopSpeaking?: () => void; // Callback para a IA parar de falar
  // Propriedades para a funcionalidade de imagem de referência - ADIÇÃO CRÍTICA
  referenceImage?: string | null; // URL da imagem de referência selecionada
  onSelectReference?: (url: string) => void; // Callback para selecionar uma imagem de referência
  onClearReference?: () => void; // Callback para remover a imagem de referência
}

// Objeto que mapeia os modos de interação às suas informações (ícone, label, cor, descrição)
const modeInfo = {
  chat: { icon: MessageCircle, label: "Conversa Livre", color: "text-emerald-400", description: "Converse livremente sobre qualquer assunto" },
  code: { icon: Code2, label: "Kojak Code", color: "text-blue-400", description: "Crie aplicativos e código profissional" },
  vision: { icon: Camera, label: "Kojak Vision", color: "text-amber-400", description: "Gere imagens profissionais com IA" },
  motion: { icon: Play, label: "Kojak Motion", color: "text-rose-400", description: "Crie vídeos em alta definição" },
};

// Sugestões de prompt para cada modo, para o EmptyState
const suggestions: Record<string, string[]> = {
  chat: [
    "Me explique como funciona a IA",
    "Quais são as tendências de tecnologia?",
    "Dicas para produtividade no trabalho",
  ],
  code: [
    "Crie uma API REST em Node.js com Express",
    "Faça um componente React de formulário de login",
    "Escreva um script Python para web scraping",
  ],
  vision: [
    "Logo minimalista para startup de tecnologia",
    "Ilustração futurista de cidade cyberpunk",
    "Banner profissional para rede social",
  ],
  motion: [
    "Ondas do mar ao pôr do sol em câmera lenta",
    "Animação abstrata com partículas coloridas",
    "Paisagem de montanhas com nuvens passando",
  ],
};

// Componente funcional para exibir o estado vazio do chat
function EmptyState({ mode, onSuggestionClick }: { mode: string; onSuggestionClick: (text: string) => void }) {
  // Obtém as informações do modo ativo ou usa o modo 'chat' como fallback
  const info = modeInfo[mode as keyof typeof modeInfo] || modeInfo.chat;
  const Icon = info.icon; // Componente de ícone dinamicamente baseado no modo
  const modeSuggestions = suggestions[mode] || suggestions.chat; // Sugestões do modo ou fallback para 'chat'

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        {/* Animação e ícone principal do Kojak IA */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-purple rounded-2xl blur-xl opacity-50 animate-pulse-slow" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-purple flex items-center justify-center glow-purple-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gradient-purple mb-2">
          Kojak IA
        </h2>
        <p className="text-muted-foreground mb-6">
          Plataforma Multimodal de Inteligência Artificial
        </p>

        {/* Cartão de informações do modo atual */}
        <div className="glass-card rounded-2xl p-4 mb-6 neon-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon className={cn("w-5 h-5", info.color)} /> {/* Usa cn para combinar classes */}
            <span className="font-semibold">{info.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>

        {/* Seção de sugestões de prompt */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Experimente perguntar:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {modeSuggestions.map((text, index) => (
              <button
                key={index} // Keys são importantes para listas em React
                onClick={() => onSuggestionClick(text)} // Repassa o clique para o ChatArea
                className="px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente principal ChatArea
export function ChatArea({
  messages,
  isLoading,
  activeMode,
  onModeChange,
  onSendMessage,
  voiceTranscript,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onSpeak,
  onStopSpeaking,
  referenceImage, // Nova prop: Imagem de referência
  onSelectReference, // Nova prop: Função para selecionar imagem de referência
  onClearReference, // Nova prop: Função para limpar imagem de referência
}: ChatAreaProps) {
  // Cria uma referência para o elemento no final das mensagens, para rolagem automática
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Função para rolar para o final do chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); // Rola suavemente
  };

  // Efeito colateral para rolar para o final sempre que as mensagens ou o estado de carregamento mudam
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handler para cliques nas sugestões do EmptyState
  const handleSuggestionClick = (text: string) => {
    onSendMessage(text, activeMode); // Envia a sugestão como uma nova mensagem
  };

  return (
    <div className="flex flex-col h-full"> {/* Container principal, ocupa toda a altura */}
      {messages.length === 0 ? ( // Condicional para exibir EmptyState ou a área de chat
        // Exibe o estado vazio se não houver mensagens
        <EmptyState mode={activeMode} onSuggestionClick={handleSuggestionClick} />
      ) : (
        // Renderiza as mensagens se houver alguma
        <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id} // Chave única para cada mensagem
                message={message}
                onSpeak={onSpeak}
                // Repassa a função onSelectReference para permitir que ChatMessage lide com imagens anexadas ou referências futuras
                onSelectReference={onSelectReference}
              />
            ))}
            {isLoading && <TypingIndicator />} {/* Exibe indicador de digitação se estiver carregando */}
            <div ref={messagesEndRef} /> {/* Elemento de referência para rolagem */}
          </div>
        </div>
      )}

      {/* Componente de entrada de chat, sempre visível na parte inferior */}
      <ChatInput
        onSend={onSendMessage} // Callback para enviar a mensagem
        isLoading={isLoading}
        activeMode={activeMode}
        onModeChange={onModeChange}
        voiceTranscript={voiceTranscript}
        isListening={isListening}
        isSpeaking={isSpeaking}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
        onStopSpeaking={onStopSpeaking}
        referenceImage={referenceImage}     // Repassa a imagem de referência para ChatInput
        onClearReference={onClearReference} // Repassa a função para limpar a imagem de referência
      />
    </div>
  );
}