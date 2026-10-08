import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, Loader2, Trash2, Settings2, Check, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUtteranceRecorder } from "@/hooks/useUtteranceRecorder";
import { speak, stopSpeech, unlockAudio } from "@/lib/streamSpeech";
import { isNative, nativeBridge, type NativeState, type SetupStatus } from "@/lib/nativeBridge";
import { getGoogleToken, onGoogleTokenChange, signInWithGoogle, GOOGLE_SCOPES, setGoogleToken } from "@/lib/sessionSync";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };
const HISTORY_KEY = "kojak_assistant_history";
const MAX_ROUNDS = 5;

const SETUP_LABELS: Record<keyof SetupStatus, string> = {
  mic: "Microfone",
  notifications: "Notificações",
  contacts: "Contatos",
  overlay: "Sobrepor outros apps",
  battery: "Sem restrição de bateria",
  wakeWordReady: "Palavra 'Kojak' pronta",
};

function actionNames(actions: unknown): string[] {
  if (!Array.isArray(actions)) return [];
  return actions.map((a: any) => (typeof a === "string" ? a : a?.name || a?.tool || a?.type)).filter(Boolean);
}

export default function Assistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const native = isNative();

  const [messages, setMessages] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  });
  const [busy, setBusy] = useState<"" | "transcribing" | "thinking" | "speaking">("");
  const [googleToken, setGToken] = useState(getGoogleToken());
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [bgOn, setBgOn] = useState(false);
  const [nativeState, setNativeState] = useState<NativeState | "">("");
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const messagesRef = useRef(messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-100)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => onGoogleTokenChange(() => setGToken(getGoogleToken())), []);

  useEffect(() => {
    if (!native) return;
    nativeBridge.isBackgroundListening().then((r) => setBgOn(!!r.running));
    const offs = [
      nativeBridge.addListener("wakeWord", () => setNativeState("listening")),
      nativeBridge.addListener("state", (d) => setNativeState(d?.state === "idle" ? "" : d?.state || "")),
      nativeBridge.addListener("assistantTurn", (d) => {
        setMessages((m) => [...m,
          { role: "user", content: String(d?.user || "") },
          { role: "assistant", content: String(d?.reply || "") }]);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [native]);

  const fail = useCallback((msg: string) => {
    toast({ title: "Assistente", description: msg, variant: "destructive" });
  }, [toast]);

  const runAssistant = useCallback(async (prompt: string) => {
    const history = messagesRef.current.slice(-20).map(({ role, content }) => ({ role, content }));
    let body: Record<string, unknown> = {
      prompt,
      history,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(getGoogleToken() ? { google_access_token: getGoogleToken() } : {}),
    };
    const used: string[] = [];
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const { data, error } = await supabase.functions.invoke("kojak-assistant", { body });
      const errText = (data as any)?.error || (error ? error.message : "");
      if (errText) {
        if (String(errText).includes("google_not_connected")) {
          setNeedsGoogle(true);
          throw new Error("Conecte sua conta Google para usar Gmail e Agenda.");
        }
        throw new Error(String(errText));
      }
      if (data?.status === "done") {
        return { reply: String(data.reply || ""), actions: [...used, ...actionNames(data.actions)] };
      }
      if (data?.status === "needs_client" && Array.isArray(data.calls)) {
        if (round === MAX_ROUNDS) break;
        const tool_results = [];
        for (const call of data.calls) {
          used.push(call.name);
          let result: unknown;
          try {
            result = await nativeBridge.runTool(call.name, call.args ?? {});
          } catch (e) {
            result = { error: e instanceof Error ? e.message : "Falha ao executar a ferramenta." };
          }
          tool_results.push({ id: call.id, result });
        }
        body = {
          state: data.state, tool_results,
          timezone: body.timezone,
          ...(getGoogleToken() ? { google_access_token: getGoogleToken() } : {}),
        };
        continue;
      }
      throw new Error("Resposta inesperada do assistente.");
    }
    throw new Error("O assistente excedeu o número de etapas.");
  }, []);

  const handleUtterance = useCallback(async (blob: Blob) => {
    setBusy("transcribing");
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(String(r.result).split(",")[1] || "");
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("kojak-live", {
        body: { audio: base64, mimeType: blob.type || "audio/webm", transcribeOnly: true },
      });
      if (error) throw new Error(error.message);
      const text = String(data?.transcript || data?.text || "").trim();
      console.log(`[voz] transcrição pronta: ${Math.round(performance.now())}ms`);
      if (!text) { setBusy(""); return; }
      setMessages((m) => [...m, { role: "user", content: text }]);
      setBusy("thinking");
      const { reply, actions } = await runAssistant(text);
      console.log(`[voz] resposta pronta: ${Math.round(performance.now())}ms`);
      setMessages((m) => [...m, { role: "assistant", content: reply, actions }]);
      setBusy("speaking");
      await speak(reply.replace(/[#*_`~]/g, ""));
    } catch (e) {
      fail(e instanceof Error ? e.message : "Não foi possível processar sua fala.");
    } finally {
      setBusy("");
    }
  }, [fail, runAssistant]);

  const { recording, level, start, stop } = useUtteranceRecorder(handleUtterance);

  const onMic = async () => {
    unlockAudio();
    if (!user) { toast({ title: "Faça login para usar o assistente" }); navigate("/auth"); return; }
    if (recording) { stop(); return; }
    stopSpeech();
    try { await start(() => stopSpeech()); }
    catch { fail("Permita o acesso ao microfone."); }
  };

  const connectGoogle = async () => {
    try {
      await signInWithGoogle({ scopes: GOOGLE_SCOPES, webRedirect: window.location.origin + "/assistente" });
      setNeedsGoogle(false);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Falha ao conectar o Google.");
    }
  };

  const toggleBg = async (on: boolean) => {
    const r = on ? await nativeBridge.startBackgroundListening() : await nativeBridge.stopBackgroundListening();
    const real = await nativeBridge.isBackgroundListening();
    setBgOn(!!real.running);
    if (on && !r.running) fail((r as any).message || "Não foi possível ativar a escuta em segundo plano.");
  };

  const configure = async () => {
    await nativeBridge.requestSetup();
    const s: any = await nativeBridge.checkSetup();
    if ("mic" in s) setSetup(s); else fail(s.message);
  };

  const statusText = recording ? "Ouvindo…" : busy === "transcribing" ? "Transcrevendo…" :
    busy === "thinking" ? "Pensando…" : busy === "speaking" ? "Falando…" :
    nativeState === "listening" || nativeState === "wake" ? "Ouvindo…" :
    nativeState === "thinking" ? "Pensando…" : nativeState === "speaking" ? "Falando…" : "Toque para falar";

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 p-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-semibold flex-1">Assistente Kojak</h1>
        <Button variant="ghost" size="sm" onClick={() => { stopSpeech(); setMessages([]); }}>
          <Trash2 className="w-4 h-4 mr-1" /> Limpar conversa
        </Button>
      </header>

      <div className="px-4 pt-3 space-y-3 shrink-0">
        {native && (
          <div className="glass-card rounded-xl p-3 flex items-center justify-between gap-3">
            <span className="text-sm">Ouvir 'Kojak' em segundo plano (app Android)</span>
            <Switch checked={bgOn} onCheckedChange={toggleBg} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {googleToken && !needsGoogle ? (
            <Badge variant="secondary" className="gap-1"><Check className="w-3 h-3" /> Google conectado</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={connectGoogle}>Conectar Google</Button>
          )}
          {googleToken && !needsGoogle && (
            <Button size="sm" variant="ghost" onClick={() => setGoogleToken("")}>Desconectar</Button>
          )}
          {native && (
            <Button size="sm" variant="outline" onClick={configure}><Settings2 className="w-4 h-4 mr-1" /> Configurar Jarvis</Button>
          )}
        </div>
        {setup && (
          <ul className="glass-card rounded-xl p-3 text-sm space-y-1">
            {(Object.keys(SETUP_LABELS) as (keyof SetupStatus)[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
                {setup[k] ? <Check className="w-4 h-4 text-primary" /> : <XIcon className="w-4 h-4 text-destructive" />}
                {SETUP_LABELS[k]}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-10">Peça algo como "quais meus próximos compromissos?"</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
              m.role === "user" ? "bg-primary text-primary-foreground" : "glass-card")}>
              {m.content}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {m.actions.map((a, j) => <Badge key={j} variant="outline" className="text-[10px]">{a}</Badge>)}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col items-center gap-3 p-6 shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          {(busy === "transcribing" || busy === "thinking") && <Loader2 className="w-4 h-4 animate-spin" />}
          {statusText}
        </span>
        <button
          onClick={onMic}
          disabled={busy === "transcribing" || busy === "thinking"}
          aria-label="Falar com o assistente"
          className={cn("w-24 h-24 rounded-full bg-gradient-purple text-primary-foreground flex items-center justify-center transition-transform disabled:opacity-60",
            recording && "animate-pulse")}
          style={{ transform: `scale(${1 + level * 0.15})` }}
        >
          <Mic className="w-10 h-10" />
        </button>
      </div>
    </div>
  );
}
