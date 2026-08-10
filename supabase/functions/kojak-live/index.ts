import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  callGroq,
  groqErrorResponse,
  jsonError,
  languageInstruction,
  missingKeyResponse,
  resolveTier,
  STT_MODEL,
  GROQ_BASE,
} from "../_shared/groq.ts";

const LIVE_PROMPT = `Você é a Kojak IA em modo Live — uma conversa por voz, em tempo real.

## REGRAS DE VOZ (obrigatórias)
- **Fale como gente fala.** Frases curtas, tom natural, sem formalidade de documento.
- **Máximo 2 ou 3 frases por resposta.** Isso é uma conversa, não uma palestra.
- **Zero formatação.** Sem markdown, sem bullets, sem asteriscos, sem blocos de código, sem emojis — tudo isso soa horrível quando falado.
- **Números e siglas por extenso** quando ajudar a pronúncia.
- **Se a pergunta for complexa**, dê a resposta essencial e ofereça detalhar: "quer que eu aprofunde?".
- **Se o áudio veio confuso ou vazio**, peça para repetir em uma frase curta.
- **Nunca invente.** Se não souber, diga que não sabe.

## LIMITE RÍGIDO
Nunca crie, estruture ou desenvolva cursos, módulos de ensino, aulas ou currículos.`;

const LANG_CODES: Record<string, string> = {
  pt: "pt", en: "en", es: "es", de: "de", zh: "zh",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { audio, mimeType, text, history, context, language, tier } = body || {};

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) return missingKeyResponse();

    const lang = LANG_CODES[String(language || "pt").slice(0, 2)] || "pt";

    // 1) Transcrição (se veio áudio)
    let transcript = typeof text === "string" ? text.trim() : "";

    if (!transcript && audio) {
      const bin = Uint8Array.from(atob(String(audio)), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("file", new Blob([bin], { type: mimeType || "audio/webm" }), "audio.webm");
      form.append("model", STT_MODEL);
      form.append("language", lang);
      form.append("temperature", "0");
      form.append("response_format", "json");

      const sttRes = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
      });

      if (!sttRes.ok) return await groqErrorResponse(sttRes, "Kojak Live STT");

      const sttData = await sttRes.json();
      transcript = String(sttData.text || "").trim();
    }

    // Filtra ruído: transcrições muito curtas ou alucinações comuns do Whisper em silêncio
    const noise = /^[\s.,!?…-]*$/.test(transcript) ||
      transcript.length < 2 ||
      /^(obrigado|thank you|thanks|legendas|subtitles|amara\.org|tchau)[.!\s]*$/i.test(transcript);

    if (noise) {
      return new Response(JSON.stringify({ transcript: "", reply: "", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Resposta conversacional
    let system = LIVE_PROMPT;
    if (context && typeof context === "string" && context.trim()) {
      system += `\n\n## CONTEXTO PESSOAL DO USUÁRIO\n${context.trim()}`;
    }
    system += languageInstruction(language);

    const messages: any[] = [{ role: "system", content: system }];
    if (Array.isArray(history)) {
      for (const m of history.slice(-12)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()) {
          messages.push({ role: m.role, content: m.content.slice(0, 2000) });
        }
      }
    }
    messages.push({ role: "user", content: transcript });

    const resolved = resolveTier(tier);
    const chatRes = await callGroq({ apiKey: GROQ_API_KEY, tier: resolved, messages, stream: false });

    if (!chatRes.ok) return await groqErrorResponse(chatRes, "Kojak Live Chat");

    const chatData = await chatRes.json();
    const reply = String(chatData.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ transcript, reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Kojak Live error:", error);
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido no Kojak Live");
  }
});
