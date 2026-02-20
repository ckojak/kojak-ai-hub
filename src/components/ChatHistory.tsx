import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils"; // Utilitário para concatenar classes CSS (Tailwind)
import type { Chat } from "@/hooks/useChats"; // Tipagem para o objeto Chat

/**
 * @interface ChatHistoryProps
 * @description Propriedades esperadas pelo componente ChatHistory.
 */
interface ChatHistoryProps {
  chats: Chat[]; // Lista de objetos Chat a serem exibidos.
  currentChatId?: string; // ID do chat atualmente selecionado (opcional).
  onSelectChat: (chat: Chat) => void; // Função para lidar com a seleção de um chat.
  onNewChat: () => void; // Função para lidar com a criação de um novo chat.
  onDeleteChat: (chatId: string) => void; // Função para lidar com a exclusão de um chat.
  onClose?: () => void; // Função para fechar o componente (geralmente usada em mobile).
  isMobile?: boolean; // Booleano indicando se o componente está sendo renderizado em um contexto mobile.
}

/**
 * @function ChatHistory
 * @description Componente React que exibe o histórico de conversas (chats).
 * Permite selecionar, criar e excluir chats, além de formatar a data de atualização.
 *
 * @param {ChatHistoryProps} props - As propriedades do componente.
 * @returns {JSX.Element} O componente ChatHistory renderizado.
 */
export function ChatHistory({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClose,
  isMobile,
}: ChatHistoryProps): JSX.Element {
  /**
   * @function formatDate
   * @description Formata uma string de data para "Hoje", "Ontem" ou "DD Mon".
   * @param {string} dateString - A string de data a ser formatada.
   * @returns {string} A data formatada.
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1); // Define a data para ontem

    // Compara as datas ignorando a hora
    if (date.toDateString() === today.toDateString()) {
      return "Hoje";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    } else {
      // Formata como "01 Jan", "15 Fev", etc.
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/95 border-r border-white/10"> {/* Adiciona bg e border para melhor contraste */}
      {/* Cabeçalho do painel do histórico de chats */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-foreground" id="chat-history-title">
          Histórico
        </h2>
        <div className="flex items-center gap-2">
          {/* Botão para iniciar um novo chat */}
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Iniciar nova conversa"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> {/* Ícone para acessibilidade */}
            <span className="text-sm font-medium">Novo</span>
          </button>
          
          {/* Botão para fechar o painel em dispositivos móveis */}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-background"
              aria-label="Fechar histórico de conversas"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de chats */}
      <div className="flex-1 overflow-y-auto chat-scrollbar p-3 space-y-2" role="group" aria-labelledby="chat-history-title">
        {chats.length === 0 ? (
          // Mensagem exibida quando não há chats
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm">Nenhuma conversa ainda</p>
            <p className="text-xs mt-1">Comece uma nova conversa!</p>
          </div>
        ) : (
          // Mapeia e renderiza cada chat individualmente
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-xl cursor-not-allowed transition-all", // cursor-not-allowed para indicar que não é clicável até o hover
                "hover:bg-white/5 backdrop-blur-sm", // Efeito de desfoque para o hover
                currentChatId === chat.id
                  ? "bg-primary/15 border border-primary/30"
                  : "border border-transparent",
                // Corrigindo comportamento do cursor ao clicar:
                currentChatId !== chat.id && "cursor-pointer" // Apenas se não for o chat atual
              )}
              onClick={() => {
                if (currentChatId !== chat.id) { // Previne clique no chat já selecionado
                  onSelectChat(chat);
                  if (isMobile && onClose) {
                    onClose();
                  }
                }
              }}
              role="button" // Indica que é um elemento clicável para acessibilidade
              tabIndex={0} // Torna o elemento focalizável
              onKeyDown={(e) => { // Suporte para teclado (Enter/Espaço)
                if ((e.key === "Enter" || e.key === " ") && currentChatId !== chat.id) {
                  e.preventDefault(); // Previne rolagem da página ao usar Espaço
                  onSelectChat(chat);
                  if (isMobile && onClose) {
                    onClose();
                  }
                }
              }}
              aria-current={currentChatId === chat.id ? "page" : undefined} // Para indicar o item selecionado em navegação
            >
              {/* Ícone representativo do chat */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              
              {/* Conteúdo do chat (título e data) */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" title={chat.title}>
                  {chat.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(chat.updated_at)}
                </p>
              </div>
              
              {/* Botão de exclusão do chat */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Impede que o clique se propague para o item pai (seleção do chat)
                  onDeleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:ring-offset-2 focus:ring-offset-background"
                aria-label={`Excluir conversa: ${chat.title}`} // Feedback para leitores de tela
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}