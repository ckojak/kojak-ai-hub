import { ChatArea } from "@/components/ChatArea";
import { useChats } from "@/hooks/useChats";
import { useVoice } from "@/hooks/useVoice";

export default function Index() {

  /*
  ---------------------------------------
  CHAT HOOK
  ---------------------------------------
  */

  const {

    messages,
    sendMessage,
    isLoading

  } = useChats();

  /*
  ---------------------------------------
  VOICE HOOK
  ---------------------------------------
  */

  const {

    speak

  } = useVoice();

  /*
  ---------------------------------------
  SAFETY FALLBACKS (PREVINE TELA PRETA)
  ---------------------------------------
  */

  const safeMessages = messages ?? [];

  const safeSendMessage = sendMessage ?? (async () => {});

  const safeSpeak = speak ?? (() => {});

  const safeLoading = isLoading ?? false;

  /*
  ---------------------------------------
  UI
  ---------------------------------------
  */

  return (

    <div className="h-screen w-full bg-background text-foreground">

      <ChatArea

        messages={safeMessages}

        isLoading={safeLoading}

        onSendMessage={safeSendMessage}

        onSpeak={safeSpeak}

      />

    </div>

  );

}