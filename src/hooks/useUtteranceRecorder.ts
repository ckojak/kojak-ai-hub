import { useCallback, useRef, useState } from "react";

/** Mesma lógica de detecção de fim de fala do Kojak Live (filtros + limiar dinâmico),
 * mas acionada por botão: grava uma fala e devolve o áudio quando a pessoa para. */
const SILENCE_MS = 800;
const MIN_SPEECH_MS = 400;
const MAX_SPEECH_MS = 20000;
const NO_SPEECH_TIMEOUT = 8000;

export function useUtteranceRecorder(onUtterance: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => { cancelRef.current?.(); }, []);

  const start = useCallback(async (onSpeechStart?: () => void) => {
    if (cancelRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
    const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.7;
    src.connect(hp); hp.connect(lp); lp.connect(an);

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    const chunks: Blob[] = [];
    let send = false;
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => undefined);
      setRecording(false); setLevel(0);
      cancelRef.current = null;
      if (send) {
        console.log(`[voz] fim da fala: ${Math.round(performance.now())}ms`);
        onUtterance(new Blob(chunks, { type: mime }));
      }
    };
    rec.start(250);
    setRecording(true);

    const buf = new Float32Array(an.fftSize);
    const startedAt = performance.now();
    let floor = 0.01; const calib: number[] = [];
    let speakingSince: number | null = null; let silenceSince: number | null = null;
    let raf = 0;
    const finish = (ok: boolean) => { cancelAnimationFrame(raf); send = ok; if (rec.state !== "inactive") rec.stop(); };
    cancelRef.current = () => finish(speakingSince !== null);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setLevel(Math.min(1, rms * 12));
      const now = performance.now();
      if (now - startedAt < 300) { calib.push(rms); return; }
      if (calib.length) { calib.sort((a, b) => a - b); floor = Math.max(0.004, calib[calib.length >> 1]); calib.length = 0; }
      const gate = Math.max(0.018, floor * 3);
      if (rms > gate) {
        silenceSince = null;
        if (speakingSince === null) { speakingSince = now; onSpeechStart?.(); }
        else if (now - speakingSince > MAX_SPEECH_MS) finish(true);
      } else if (speakingSince !== null) {
        if (silenceSince === null) silenceSince = now;
        if (now - silenceSince > SILENCE_MS) finish(silenceSince - speakingSince >= MIN_SPEECH_MS);
      } else if (now - startedAt > NO_SPEECH_TIMEOUT) finish(false);
    };
    raf = requestAnimationFrame(tick);
  }, [onUtterance]);

  return { recording, level, start, stop };
}
