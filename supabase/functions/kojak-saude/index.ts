import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  GEMINI_BASE,
  geminiErrorResponse,
  geminiStreamToOpenAISSE,
< lovable-sync-1786317085
=======
  languageInstruction,
  main
  missingKeyResponse,
  toGeminiContents,
} from "../_shared/gemini.ts";

const FAST_MODEL = "gemini-3.5-flash";
const THINKING_MODEL = "gemini-3.1-pro-preview";

/** Aceita mode: "fast" | "thinking" ou tier: "rapido" | "raciocinio". */
function pickModel(mode?: string, tier?: string) {
  const v = String(mode || tier || "").toLowerCase();
  return ["thinking", "raciocinio", "pro", "avancado"].includes(v) ? THINKING_MODEL : FAST_MODEL;
}


const SYSTEM_PROMPT = `Você é Kojak IA — especialista em Saúde, Medicina e Ciências da Vida, conversando como um médico-amigo didático.

## ESPECIALIDADES
Saúde pública brasileira (SUS, Fiocruz), medicina clínica, epidemiologia, virologia, farmacologia, nutrição baseada em evidência, saúde mental, biossegurança, terapia fotodinâmica.

## COMO VOCÊ RESPONDE
- **Curto e claro.** 2-4 frases ou bullets pequenos. Sem textões densos.
- **Sem alarmismo.** Equilibrado, honesto sobre incertezas.
- **Linguagem acessível.** Traduza a ciência — nada de jargão sem explicação, nada de analogia com tecnologia.
- **Baseado em evidência.** Cite estudos/consenso só quando pedirem ou for essencial.
- **Contexto Brasil.** Considere SUS, disponibilidade local, realidade brasileira.
- **Dialogue.** Termine com uma pergunta curta ou próximo passo prático quando ajudar.
- **Aprofunde só quando pedirem.** ("me explica melhor", "detalha os estudos", "protocolo completo")

## FORMATO
- Bullets curtos > parágrafos longos.
- Insights práticos > listas exaustivas.
- Português do Brasil.

## LIMITE RÍGIDO
Nunca crie, estruture ou desenvolva cursos, módulos de ensino ou currículos. Recuse educadamente.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
<<<<<< lovable-sync-1786317085
    const { prompt, history, context, mode, tier, stream = true } = body || {};
=======
    const { prompt, history, context, mode, tier, language, stream = true } = body || {};
  main
    const MODEL = pickModel(mode, tier);

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return missingKeyResponse();

    const systemContent = (context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`
<<<<< lovable-sync-1786317085
      : SYSTEM_PROMPT;
=======
      : SYSTEM_PROMPT) + languageInstruction(language);
    main

    const messages: any[] = [];
    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: prompt });

    const endpoint = stream
      ? `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse`
      : `${GEMINI_BASE}/${MODEL}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemContent }] },
        contents: toGeminiContents(messages),
      }),
    });

    if (!response.ok) return await geminiErrorResponse(response, "Gemini saude error:");

    if (stream && response.body) {
      return new Response(geminiStreamToOpenAISSE(response.body), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    const content = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text ?? "")
      .join("") || "Desculpe, não consegui gerar uma resposta.";

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: "text",
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Saude error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});