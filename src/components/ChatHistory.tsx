import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Chat } from "@/hooks/useChats";

interface ChatHistoryProps {
  chats: Chat[];
  currentChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function ChatHistory({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClose,
  isMobile,
}: ChatHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoje";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Novo</span>
          </button>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto chat-scrollbar p-3 space-y-2">
        {chats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma conversa ainda</p>
            <p className="text-xs mt-1">Comece uma nova conversa!</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                "hover:bg-white/5 backdrop-blur-sm",
                currentChatId === chat.id
                  ? "bg-primary/15 border border-primary/30"
                  : "border border-transparent"
              )}
              onClick={() => {
                onSelectChat(chat);
                if (isMobile && onClose) onClose();
              }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {chat.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(chat.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
