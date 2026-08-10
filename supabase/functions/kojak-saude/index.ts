import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  languageInstruction,
} from "../_shared/gemini.ts";

const FAST_MODEL = "llama-3.1-8b-instant";
const THINKING_MODEL = "llama-3.3-70b-versatile";

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
    const { prompt, history, context, mode, tier, language, stream = true } = body || {};
    const MODEL = pickModel(mode, tier);

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não está configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemContent = (context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`
      : SYSTEM_PROMPT) + languageInstruction(language);

    const messages: any[] = [
      { role: "system", content: systemContent }
    ];

    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: prompt });

    const payload = {
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      stream: stream,
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Erro na API Groq (Saúde): ${response.status} - ${errText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (stream && response.body) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

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
    console.error("Kojak Saude Groq error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
