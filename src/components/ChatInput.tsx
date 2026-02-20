import { useState, useRef } from "react";
import { Send, ImagePlus } from "lucide-react";

export interface SendMessagePayload {

  content?: string;
  imageFile?: File | null;

}

interface Props {

  onSend: (payload: SendMessagePayload) => Promise<void>;
  isLoading: boolean;

}

export function ChatInput({ onSend, isLoading }: Props) {

  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {

    if (!text.trim()) return;

    await onSend({

      content: text

    });

    setText("");

  };

  return (

    <div className="flex gap-2 p-4 border-t">

      <textarea

        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 border rounded p-2"

      />

      <button onClick={send} disabled={isLoading}>

        <Send size={18}/>

      </button>

      <input hidden type="file" ref={fileRef}/>

    </div>

  );

}