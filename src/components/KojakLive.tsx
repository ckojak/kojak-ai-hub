import { useState, useRef, useCallback, useEffect } from "react";
import { X, Mic, MicOff, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, LOCALE_MAP } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { KOJAK_LOGO_BASE64 } from "@/assets/kojak-logo";
import { cn } from "@/lib/utils";

interface KojakLiveProps {
  onClose: () => void;
}

type LiveStatus = "connecting" | "listening" | "capturing" | "thinking" | "speaking" | "error";

/** Silêncio necessário (ms) para considerar que a pessoa terminou de falar. */
const SILENCE_MS = 900;
/** Duração mínima (ms) de fala para valer o envio — corta tosse, clique, "ãh". */
const MIN_SPEECH_MS = 400;
/** Duração máxima de um turno. */
const MAX_SPEECH_MS = 20000;

export function KojakLive({ onClose }: KojakLiveProps) {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();

  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  /** Sensibilidade: quanto maior, mais perto a pessoa precisa estar. */
  const [sensitivity, setSensitivity] = useState(3);
  const [lastUser, setLastUser] = useState("");
  const [lastReply, setLastReply] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speakingSinceRef = useRef<number | null>(null);
  const silenceSinceRef = useRef<number | null>(null);
  const noiseFloorRef = useRef(0.01);
  const busyRef = useRef(false);
  const mutedRef = useRef(false);
  const sensitivityRef = useRef(3);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const closedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

  const finishSpeaking = useCallback(() => {
    busyRef.current = false;
    if (!closedRef.current) setStatus("listening");
  }, []);

  /** Fallback: voz nativa do navegador (só se a voz neural falhar). */
  const speakBrowserFallback = useCallback((text: string) => {
    if (!text || !("speechSynthesis" in window)) { finishSpeaking(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE_MAP[language] || "pt-BR";
    u.rate = 1.02;
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith(u.lang.slice(0, 2)) &&
        /female|feminina|luciana|francisca|google/i.test(v.name),
    ) || voices.find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
    if (preferred) u.voice = preferred;

    u.onend = finishSpeaking;
    u.onerror = finishSpeaking;
    window.speechSynthesis.speak(u);
  }, [language, finishSpeaking]);

  /** Voz neural Kore (Gemini TTS) via edge function, com fallback nativo. */
  const speakReply = useCallback(async (text: string) => {
    const clean = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]+`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~]/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (!clean) { finishSpeaking(); return; }

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setStatus("speaking");

    try {
      const { data, error } = await supabase.functions.invoke("kojak-voice", {
        body: { text: clean, voice: "Kore" },
      });
      if (closedRef.current) return;
      if (error || !data?.audio) throw new Error(error?.message || "sem áudio");

      const audio = new Audio(data.audio);
      audioRef.current = audio;
      audio.onended = finishSpeaking;
      audio.onerror = () => speakBrowserFallback(clean);
      await audio.play().catch(() => speakBrowserFallback(clean));
    } catch (err) {
      console.error("Kojak Live voz neural indisponível:", err);
      if (!closedRef.current) speakBrowserFallback(clean);
    }
  }, [finishSpeaking, speakBrowserFallback]);


  const sendUtterance = useCallback(async (blob: Blob) => {
    if (closedRef.current) return;
    setStatus("thinking");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke("kojak-live", {
        body: {
          audio: base64,
          mimeType: blob.type || "audio/webm",
          history: historyRef.current.slice(-12),
          context: profile?.personal_context || "",
          language,
          tier: "rapido",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.skipped || !data?.reply) {
        busyRef.current = false;
        if (!closedRef.current) setStatus("listening");
        return;
      }

      historyRef.current.push({ role: "user", content: data.transcript });
      historyRef.current.push({ role: "assistant", content: data.reply });
      setLastUser(data.transcript);
      setLastReply(data.reply);
      speakReply(data.reply);
    } catch (err) {
      console.error("Kojak Live:", err);
      busyRef.current = false;
      if (!closedRef.current) {
        setStatus("listening");
        toast({
          title: "Kojak Live",
          description: err instanceof Error ? err.message : "Falha ao processar o áudio.",
          variant: "destructive",
        });
      }
    }
  }, [language, profile, speakReply, toast]);

  const cleanup = useCallback(() => {
    closedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { recorderRef.current?.state !== "inactive" && recorderRef.current?.stop(); } catch { /* noop */ }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    closedRef.current = false;

    async function start() {
      try {
        // Microfone com cancelamento de eco, supressão de ruído e ganho automático.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
        });
        if (closedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);

        // Filtro passa-alta corta rumor/ar-condicionado; passa-baixa corta chiado.
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 120;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 6000;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        analyserRef.current = analyser;

        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(analyser);

        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        setStatus("listening");

        const buf = new Float32Array(analyser.fftSize);
        let calibrating = true;
        let calibrationSamples: number[] = [];
        const startedAt = performance.now();

        const startRecording = () => {
          chunksRef.current = [];
          const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
          recorderRef.current = rec;
          rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          rec.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mime });
            chunksRef.current = [];
            if (blob.size > 2000) sendUtterance(blob);
            else { busyRef.current = false; if (!closedRef.current) setStatus("listening"); }
          };
          rec.start();
          setStatus("capturing");
        };

        const stopRecording = () => {
          const rec = recorderRef.current;
          recorderRef.current = null;
          if (rec && rec.state !== "inactive") rec.stop();
        };

        const tick = () => {
          if (closedRef.current) return;
          rafRef.current = requestAnimationFrame(tick);

          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 12));

          const now = performance.now();

          // Calibra o piso de ruído do ambiente no primeiro 1,2s.
          if (calibrating) {
            calibrationSamples.push(rms);
            if (now - startedAt > 1200) {
              calibrationSamples.sort((a, b) => a - b);
              const median = calibrationSamples[Math.floor(calibrationSamples.length / 2)] || 0.005;
              noiseFloorRef.current = Math.max(0.004, median);
              calibrating = false;
            }
            return;
          }

          // Não capta enquanto a IA fala, enquanto processa, ou no mudo.
          if (mutedRef.current || busyRef.current) {
            if (recorderRef.current) stopRecording();
            speakingSinceRef.current = null;
            silenceSinceRef.current = null;
            return;
          }

          // Limiar dinâmico: ruído de fundo * sensibilidade. Vozes distantes ficam
          // abaixo do limiar e são ignoradas.
          const gate = Math.max(0.018, noiseFloorRef.current * (2 + sensitivityRef.current * 1.6));
          const isSpeech = rms > gate;

          if (isSpeech) {
            silenceSinceRef.current = null;
            if (speakingSinceRef.current === null) {
              speakingSinceRef.current = now;
              startRecording();
            } else if (now - speakingSinceRef.current > MAX_SPEECH_MS) {
              busyRef.current = true;
              speakingSinceRef.current = null;
              stopRecording();
            }
          } else if (speakingSinceRef.current !== null) {
            if (silenceSinceRef.current === null) silenceSinceRef.current = now;
            if (now - silenceSinceRef.current > SILENCE_MS) {
              const duration = silenceSinceRef.current - speakingSinceRef.current;
              speakingSinceRef.current = null;
              silenceSinceRef.current = null;
              if (duration >= MIN_SPEECH_MS) {
                busyRef.current = true;
                stopRecording();
              } else {
                // Ruído curto: descarta.
                const rec = recorderRef.current;
                recorderRef.current = null;
                if (rec && rec.state !== "inactive") { rec.onstop = null as any; rec.stop(); }
                chunksRef.current = [];
                setStatus("listening");
              }
            }
          }
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("Kojak Live init:", err);
        setStatus("error");
        setErrorMsg(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Permita o acesso ao microfone para usar o Kojak Live."
            : err instanceof Error ? err.message : "Não foi possível iniciar o Kojak Live.",
        );
      }
    }

    start();
    return cleanup;
  }, [cleanup, sendUtterance]);

  const handleClose = () => { cleanup(); onClose(); };

  const statusLabel: Record<LiveStatus, string> = {
    connecting: t("liveConnecting"),
    listening: t("liveListening"),
    capturing: t("liveCapturing"),
    thinking: t("liveThinking"),
    speaking: t("liveSpeaking"),
    error: t("errorTitle"),
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-semibold tracking-tight">Kojak Live</span>
        <button onClick={handleClose} className="w-9 h-9 rounded-full glass-card flex items-center justify-center hover:border-primary/40 transition-colors" aria-label={t("close")}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <div className="relative w-36 h-36">
          <div
            className="absolute inset-0 rounded-full bg-gradient-purple blur-2xl transition-opacity duration-200"
            style={{ opacity: 0.25 + level * 0.6 }}
          />
          <div
            className={cn(
              "relative w-full h-full rounded-full overflow-hidden bg-gradient-purple flex items-center justify-center transition-transform duration-100",
              status === "speaking" && "animate-pulse-slow",
            )}
            style={{ transform: `scale(${1 + level * 0.12})` }}
          >
            <img src={KOJAK_LOGO_BASE64} alt="Kojak IA" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="text-center min-h-[3rem]">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {(status === "thinking" || status === "connecting") && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === "speaking" && <Volume2 className="w-4 h-4 text-primary" />}
            <span>{statusLabel[status]}</span>
          </div>
          {errorMsg && <p className="mt-3 text-sm text-destructive max-w-xs">{errorMsg}</p>}
        </div>

        {(lastUser || lastReply) && (
          <div className="w-full max-w-md space-y-3">
            {lastUser && (
              <p className="text-xs text-muted-foreground text-right">"{lastUser}"</p>
            )}
            {lastReply && (
              <div className="glass-card rounded-2xl p-4 text-sm leading-relaxed">{lastReply}</div>
            )}
          </div>
        )}

        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{t("liveSensitivity")}</span>
            <span>{sensitivity <= 2 ? t("liveFar") : sensitivity >= 5 ? t("liveClose") : t("liveNormal")}</span>
          </div>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label={t("liveSensitivity")}
          />
          <p className="mt-2 text-[11px] text-muted-foreground text-center">{t("liveSensitivityHint")}</p>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-4 p-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3rem)" }}
      >
        <button
          onClick={() => setMuted((v) => !v)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors glass-card",
            muted ? "bg-destructive/20 border-destructive/40 text-destructive" : "hover:border-primary/40",
          )}
          aria-label={muted ? t("liveUnmute") : t("liveMute")}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button
          onClick={handleClose}
          className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-105 transition-transform"
          aria-label={t("liveEnd")}
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
