import { useState, useRef, useCallback, useEffect } from "react";
import { X, Mic, MicOff, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { KOJAK_LOGO_BASE64 } from "@/assets/kojak-logo";

interface KojakLiveProps {
  onClose: () => void;
}

// Converte Float32 (formato do microfone do navegador) pra Int16 PCM (formato que a Gemini espera)
function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function KojakLive({ onClose }: KojakLiveProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<"connecting" | "listening" | "speaking" | "error">("connecting");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);

  // Fila de reprodução do áudio que a Gemini manda de volta
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const playbackContextRef = useRef<AudioContext | null>(null);

  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    isPlayingRef.current = true;
    setStatus("speaking");
    const buffer = playbackQueueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (playbackQueueRef.current.length > 0) {
        playNextChunk();
      } else {
        setStatus("listening");
      }
    };
    source.start();
  }, []);

  const enqueueAudio = useCallback((base64Audio: string) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    const pcmBuffer = base64ToArrayBuffer(base64Audio);
    const pcm16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    // A Gemini Live devolve áudio a 24kHz, mono
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);
    playbackQueueRef.current.push(audioBuffer);
    playNextChunk();
  }, [playNextChunk]);

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    playbackContextRef.current?.close();
    playbackContextRef.current = null;
    playbackQueueRef.current = [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // 1. Pede o token efêmero pro nosso backend (a chave real nunca sai do Supabase)
        const { data, error } = await supabase.functions.invoke("kojak-live-token", {
          body: { userId: user?.id ?? null },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message || "Erro ao iniciar Kojak Live");
        }
        if (cancelled) return;

        const { token, model } = data;

        // 2. Abre o microfone
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
        if (cancelled) { micStream.getTracks().forEach(t => t.stop()); return; }
        micStreamRef.current = micStream;

        // 3. Contextos de áudio (um pra captar, um pra tocar — evita eco entre os dois)
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });

        // 4. Abre o WebSocket direto com a Gemini, usando o token efêmero (não a chave real)
        const ws = new WebSocket(
          `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?access_token=${token}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          // Primeira mensagem OBRIGATÓRIA: setup (modelo já veio travado no token)
          ws.send(JSON.stringify({ setup: { model } }));
        };

        ws.onmessage = async (event) => {
          if (cancelled) return;
          const text = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          let msg: any;
          try {
            msg = JSON.parse(text);
          } catch {
            return;
          }

          if (msg.setupComplete) {
            setStatus("listening");

            // Começa a mandar áudio do microfone só depois do setup confirmado
            const source = audioContext.createMediaStreamSource(micStream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
              const input = e.inputBuffer.getChannelData(0);
              const pcm = floatTo16BitPCM(input);
              ws.send(JSON.stringify({
                realtimeInput: {
                  audio: { data: arrayBufferToBase64(pcm), mimeType: "audio/pcm;rate=16000" },
                },
              }));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
            return;
          }

          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                enqueueAudio(part.inlineData.data);
              }
            }
          }

          // Gemini avisa quando a pessoa começa a falar (interrupção) — para o que tava tocando
          if (msg.serverContent?.interrupted) {
            playbackQueueRef.current = [];
            isPlayingRef.current = false;
            setStatus("listening");
          }
        };

        ws.onerror = () => {
          if (cancelled) return;
          setStatus("error");
          setErrorMsg("Erro na conexão com o Kojak Live.");
        };

        ws.onclose = () => {
          if (cancelled) return;
          setStatus((s) => (s === "error" ? s : "error"));
        };
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setStatus("error");
        setErrorMsg(message);
        toast({ title: "Kojak Live", description: message, variant: "destructive" });
      }
    }

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  const handleEndCall = () => {
    cleanup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-6">
      <button
        onClick={handleEndCall}
        className="absolute top-6 right-6 p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-40 h-40 mb-8">
        <div
          className={`absolute inset-0 rounded-full bg-gradient-purple blur-2xl transition-opacity ${
            status === "speaking" ? "opacity-70 animate-pulse" : status === "listening" ? "opacity-40" : "opacity-20"
          }`}
        />
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-primary/40 glow-purple-lg">
          <img src={KOJAK_LOGO_BASE64} alt="Kojak Live" className="w-full h-full object-cover" />
        </div>
        {status === "listening" && (
          <div className="absolute -inset-2 rounded-full border-2 border-primary/30 animate-ping" />
        )}
      </div>

      <h2 className="text-xl font-bold text-gradient-purple mb-1">Kojak Live</h2>
      <p className="text-sm text-muted-foreground mb-8">
        {status === "connecting" && "Conectando..."}
        {status === "listening" && "Ouvindo — pode falar"}
        {status === "speaking" && "Kojak está falando..."}
        {status === "error" && (errorMsg || "Algo deu errado")}
      </p>

      <div className="flex items-center gap-6">
        <button
          onClick={toggleMute}
          disabled={status === "error"}
          className={`p-4 rounded-full transition-all ${
            muted ? "bg-destructive text-white" : "bg-foreground/10 hover:bg-foreground/20"
          }`}
        >
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-destructive text-white hover:scale-105 transition-transform"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}