import { supabase } from "@/integrations/supabase/client";

const SAMPLE_RATE = 24000;
let ctx: AudioContext | null = null;
let nextTime = 0;
let generation = 0;
const active = new Set<AudioBufferSourceNode>();

export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  } catch { /* noop */ }
  return ctx;
}

if (typeof window !== "undefined") {
  const once = () => { unlockAudio(); window.removeEventListener("pointerdown", once); window.removeEventListener("touchstart", once); };
  window.addEventListener("pointerdown", once);
  window.addEventListener("touchstart", once);
}

/** Para o áudio atual e cancela a fila. */
export function stopSpeech() {
  generation++;
  active.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
  active.clear();
  nextTime = 0;
  window.speechSynthesis?.cancel();
}

export function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && merged[merged.length - 1].length < 15) merged[merged.length - 1] += " " + p;
    else merged.push(p);
  }
  return merged;
}

let firstAudioMark: number | null = null;
function schedule(buffer: AudioBuffer, gen: number) {
  if (!ctx || gen !== generation) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  const start = Math.max(ctx.currentTime + 0.02, nextTime);
  src.start(start);
  nextTime = start + buffer.duration;
  active.add(src);
  src.onended = () => active.delete(src);
  if (firstAudioMark !== null) {
    console.log(`[voz] primeiro áudio tocando: +${Math.round(performance.now() - firstAudioMark)}ms após speak()`);
    firstAudioMark = null;
  }
}

function pcmToBuffer(bytes: Uint8Array): AudioBuffer {
  const n = bytes.length >> 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const buf = ctx!.createBuffer(1, n, SAMPLE_RATE);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
  return buf;
}

async function authHeaders() {
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data } = await supabase.auth.getSession();
  return {
    apikey: anon,
    Authorization: `Bearer ${data.session?.access_token || anon}`,
    "Content-Type": "application/json",
  };
}

/** Busca o áudio de uma frase. Entrega AudioBuffers via onBuffer conforme chegam. */
async function fetchSentence(text: string, voice: string, onBuffer: (b: AudioBuffer) => void, gen: number) {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kojak-voice`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ text, voice, stream: true }),
    });
    const fmt = (res.headers.get("X-Audio-Format") || "").toLowerCase();
    if (res.ok && res.body && fmt.includes("pcm")) {
      const reader = res.body.getReader();
      let leftover: Uint8Array | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done || gen !== generation) break;
        if (!value?.length) continue;
        let bytes = value;
        if (leftover) {
          const m = new Uint8Array(leftover.length + value.length);
          m.set(leftover); m.set(value, leftover.length);
          bytes = m; leftover = null;
        }
        if (bytes.length % 2) { leftover = bytes.slice(bytes.length - 1); bytes = bytes.slice(0, bytes.length - 1); }
        if (bytes.length) onBuffer(pcmToBuffer(bytes));
      }
      return true;
    }
    // Modo antigo: JSON com base64.
    let json: any = null;
    if (res.ok && (res.headers.get("content-type") || "").includes("json")) json = await res.json();
    else {
      const r = await supabase.functions.invoke("kojak-voice", { body: { text, voice } });
      json = r.data;
    }
    const audio: string | undefined = json?.audio;
    if (!audio) return false;
    const b64 = audio.includes(",") ? audio.split(",")[1] : audio;
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const decoded = await ctx!.decodeAudioData(bin.buffer.slice(0));
    onBuffer(decoded);
    return true;
  } catch (e) {
    console.warn("[voz] falha kojak-voice:", e);
    return false;
  }
}

function browserSpeak(text: string, lang: string) {
  return new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Fala o texto em pipeline. Resolve quando termina (ou é cancelado). */
export async function speak(text: string, opts: { voice?: string; lang?: string } = {}) {
  stopSpeech();
  const gen = generation;
  const voice = opts.voice || "Algenib";
  const sentences = splitSentences(text);
  if (!sentences.length) return;
  unlockAudio();
  if (!ctx) { await browserSpeak(text, opts.lang || "pt-BR"); return; }
  firstAudioMark = performance.now();

  type Job = { buffers: AudioBuffer[]; sink: ((b: AudioBuffer) => void) | null; done: Promise<boolean> };
  const startJob = (s: string): Job => {
    const job: Job = { buffers: [], sink: null, done: Promise.resolve(false) };
    job.done = fetchSentence(s, voice, (b) => (job.sink ? job.sink(b) : job.buffers.push(b)), gen);
    return job;
  };

  let current = startJob(sentences[0]);
  for (let i = 0; i < sentences.length; i++) {
    if (gen !== generation) return;
    const next = i + 1 < sentences.length ? startJob(sentences[i + 1]) : null; // prefetch 1 frase
    current.buffers.forEach((b) => schedule(b, gen));
    current.buffers = [];
    current.sink = (b) => schedule(b, gen);
    const ok = await current.done;
    if (!ok && gen === generation) {
      // espera o que já está tocando e usa a voz do navegador só nessa frase
      await waitUntilDrained(gen);
      await browserSpeak(sentences[i], opts.lang || "pt-BR");
    }
    if (!next) break;
    // Não deixa a fila crescer demais: começa a próxima perto do fim da atual.
    current = next;
  }
  await waitUntilDrained(gen);
}

function waitUntilDrained(gen: number) {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (gen !== generation || !ctx || ctx.currentTime >= nextTime - 0.01) return resolve();
      setTimeout(check, 50);
    };
    check();
  });
}
