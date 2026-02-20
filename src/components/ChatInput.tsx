import {
  Send,
  Mic,
  MicOff,
  Square,
  ImagePlus,
  X,
} from "lucide-react";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export interface SendMessagePayload {
  content?: string;
  imageFile?: File | null;
}

interface ChatInputProps {
  onSend: (payload: SendMessagePayload) => Promise<void> | void;
  isLoading: boolean;

  voiceTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;

  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;

  referenceImage?: string | null;
  onClearReference?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function ChatInput({
  onSend,
  isLoading,
  voiceTranscript,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  referenceImage,
  onClearReference,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (voiceTranscript) {
      setText(voiceTranscript);
    }
  }, [voiceTranscript]);

  const validateFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas PNG, JPEG e WEBP",
        variant: "destructive",
      });

      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Imagem muito grande",
        description: "Máximo 5MB",
        variant: "destructive",
      });

      return false;
    }

    return true;
  }, []);

  const handleSelectImage = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;

      setImageFile(file);
    },
    [validateFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      handleSelectImage(file);

      e.target.value = "";
    },
    [handleSelectImage]
  );

  const handleSend = useCallback(async () => {
    if (isSendingRef.current) return;

    if (!text.trim() && !imageFile && !referenceImage)
      return;

    isSendingRef.current = true;

    try {
      await onSend({
        content: text.trim(),
        imageFile,
      });

      setText("");
      setImageFile(null);

      onClearReference?.();

    } catch (err) {
      console.error(err);

      toast({
        title: "Erro ao enviar",
        variant: "destructive",
      });

    } finally {
      isSendingRef.current = false;
    }
  }, [
    text,
    imageFile,
    referenceImage,
    onSend,
    onClearReference,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-white/10 p-3 space-y-2">

      {(imageFile || referenceImage) && (
        <div className="relative w-fit">

          <img
            src={
              imageFile
                ? URL.createObjectURL(imageFile)
                : referenceImage!
            }
            className="w-20 h-20 rounded-lg object-cover"
          />

          <button
            onClick={() => {
              setImageFile(null);
              onClearReference?.();
            }}
            className="absolute -top-2 -right-2 bg-black rounded-full p-1"
          >
            <X size={14} />
          </button>

        </div>
      )}

      <div className="flex gap-2">

        <Textarea
          value={text}
          onChange={(e) =>
            setText(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          className="resize-none"
        />

        <div className="flex flex-col gap-2">

          <Button
            size="icon"
            variant="secondary"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <ImagePlus size={18} />
          </Button>

          {isListening ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={onStopListening}
            >
              <MicOff size={18} />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="secondary"
              onClick={onStartListening}
            >
              <Mic size={18} />
            </Button>
          )}

          {isSpeaking && (
            <Button
              size="icon"
              variant="destructive"
              onClick={onStopSpeaking}
            >
              <Square size={18} />
            </Button>
          )}

          <Button
            size="icon"
            onClick={handleSend}
            disabled={isLoading}
          >
            <Send size={18} />
          </Button>

        </div>

      </div>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
      />

    </div>
  );
}