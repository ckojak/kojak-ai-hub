import { useState } from "react";
import { 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistory } from "./ChatHistory";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import type { Chat } from "@/hooks/useChats";

interface SidebarProps {
  chats: Chat[];
  currentChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ 
  chats, 
  currentChatId, 
  onSelectChat, 
  onNewChat, 
  onDeleteChat,
  onOpenSettings,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

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
          onClick={onOpenSettings}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            collapsed && "justify-center"
          )}
        >
          <Settings className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Configurações</span>}
        </button>

        {/* User Profile / Login */}
        {user && profile ? (
          <div
            onClick={onOpenSettings}
            className={cn(
              "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all",
              "hover:bg-white/5",
              collapsed && "justify-center"
            )}
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-purple text-white text-xs">
                {profile.full_name?.charAt(0).toUpperCase() || "K"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.full_name || "Usuário"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {profile.email || user.email}
                </p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all",
              "text-primary hover:bg-primary/10",
              collapsed && "justify-center"
            )}
          >
            <LogIn className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-medium">Fazer login</span>}
          </button>
        )}
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
