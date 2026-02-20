import { useRef, useEffect, useCallback } from "react";
import { ChatMessage, Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  activeMode: string;
  onModeChange: (mode: string) => void;
  onSendMessage: any;
  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
  referenceImage?: string | null;
  onSelectReference?: (url: string) => void;
  onClearReference?: () => void;
}

export function ChatArea(props: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [props.messages, props.isLoading, scrollToBottom]);

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto">
        {props.messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onSpeak={props.onSpeak}
            onSelectReference={props.onSelectReference}
          />
        ))}

        {props.isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={props.onSendMessage}
        isLoading={props.isLoading}
        activeMode={props.activeMode}
        onModeChange={props.onModeChange}
        voiceTranscript={props.voiceTranscript}
        isListening={props.isListening}
        isSpeaking={props.isSpeaking}
        onStartListening={props.onStartListening}
        onStopListening={props.onStopListening}
        onStopSpeaking={props.onStopSpeaking}
        referenceImage={props.referenceImage}
        onClearReference={props.onClearReference}
      />

    </div>
  );
}