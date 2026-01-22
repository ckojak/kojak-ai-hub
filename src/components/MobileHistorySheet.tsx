import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatHistory } from "./ChatHistory";
import type { Chat } from "@/hooks/useChats";

interface MobileHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chats: Chat[];
  currentChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function MobileHistorySheet({
  open,
  onOpenChange,
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: MobileHistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[85vw] max-w-sm p-0 border-r border-white/10 bg-black/95 backdrop-blur-xl"
      >
        <ChatHistory
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={onSelectChat}
          onNewChat={onNewChat}
          onDeleteChat={onDeleteChat}
          onClose={() => onOpenChange(false)}
          isMobile
        />
      </SheetContent>
    </Sheet>
  );
}
