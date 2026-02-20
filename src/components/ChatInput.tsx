import {
  Send,
  ImagePlus,
  X,
} from "lucide-react";

import {
  useState,
  useRef,
  useCallback,
} from "react";

export interface SendMessagePayload {
  content?: string;
  imageFile?: File | null;
}

interface Props {
  onSend: (payload: SendMessagePayload) => Promise<void>;
  isLoading: boolean;

  referenceImage?: string | null;
  onClearReference?: () => void;
}

const MAX_SIZE = 5 * 1024 * 1024;

const TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function ChatInput({
  onSend,
  isLoading,
  referenceImage,
  onClearReference,
}: Props) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const fileRef =
    useRef<HTMLInputElement>(null);

  const validate = (file: File) => {
    if (!TYPES.includes(file.type))
      return false;

    if (file.size > MAX_SIZE)
      return false;

    return true;
  };

  const send = useCallback(async () => {
    if (!text && !imageFile) return;

    await onSend({
      content: text,
      imageFile,
    });

    setText("");
    setImageFile(null);
    onClearReference?.();

  }, [text, imageFile, onSend, onClearReference]);

  return (
    <div>

      {(imageFile || referenceImage) && (
        <div>

          <img
            src={
              imageFile
                ? URL.createObjectURL(imageFile)
                : referenceImage!
            }
            width={80}
          />

          <button
            onClick={() => {
              setImageFile(null);
              onClearReference?.();
            }}
          >
            <X />
          </button>

        </div>
      )}

      <div className="flex gap-2">

        <textarea
          value={text}
          onChange={(e) =>
            setText(e.target.value)
          }
        />

        <button
          onClick={() =>
            fileRef.current?.click()
          }
        >
          <ImagePlus />
        </button>

        <button
          onClick={send}
          disabled={isLoading}
        >
          <Send />
        </button>

      </div>

      <input
        type="file"
        hidden
        ref={fileRef}
        onChange={(e) => {
          const file =
            e.target.files?.[0];

          if (!file) return;

          if (!validate(file))
            return;

          setImageFile(file);
        }}
      />

    </div>
  );
}