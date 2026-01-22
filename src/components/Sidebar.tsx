import { useState } from "react";
import { 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistory } from "./ChatHistory";
import type { Chat } from "@/hooks/useChats";

interface SidebarProps {
  chats: Chat[];
  currentChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function Sidebar({ 
  chats, 
  currentChatId, 
  onSelectChat, 
  onNewChat, 
  onDeleteChat 
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 h-screen z-50 flex-col transition-all duration-300",
        "bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-xl border-r border-white/10",
        collapsed ? "w-16" : "w-72"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-purple glow-purple">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gradient-purple">Kojak AI</span>
            <span className="text-[10px] text-muted-foreground">Multimodal Platform</span>
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2.5 rounded-xl transition-all",
            "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30",
            collapsed && "justify-center"
          )}
        >
          <Plus className="w-5 h-5" />
          {!collapsed && <span className="font-medium">Nova Conversa</span>}
        </button>
      </div>

      {/* Chat History */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          <ChatHistory
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={onSelectChat}
            onNewChat={onNewChat}
            onDeleteChat={onDeleteChat}
          />
        </div>
      )}

      {/* Bottom Actions */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <button
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            collapsed && "justify-center"
          )}
        >
          <Settings className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Configurações</span>}
        </button>
        <button
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            collapsed && "justify-center"
          )}
        >
          <User className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Perfil</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 flex items-center justify-center rounded-full bg-background border border-white/20 hover:border-primary/50 transition-all"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
