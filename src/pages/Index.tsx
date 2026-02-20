import { ChatArea } from "@/components/ChatArea";
import { useChats } from "@/hooks/useChats";
import { useVoice } from "@/hooks/useVoice";

export default function Index() {

  const {

    messages,
    sendMessage,
    isLoading

  } = useChats();

  const {

    speak

  } = useVoice();

  return (

    <div className="h-screen">

      <ChatArea

        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        onSpeak={speak}

      />

    </div>

  );

}