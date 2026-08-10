import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  languageInstruction,
} from "../_shared/gemini.ts";

const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `Você é Kojak IA — um parceiro de conversa inteligente, didático e humano.

## COMO VOCÊ CONVERSA
- **Curto por padrão.** Responda em 1-3 frases ou uma lista pequena. Nada de textões.
- **Vá direto ao ponto.** Sem "Claro!", "Ótima pergunta!", "Espero ter ajudado".
- **Didático, não catedrático.** Explique como um amigo especialista: exemplo rápido > teoria longa.
- **Dialogue de verdade.** Termine com uma pergunta curta ou próximo passo quando fizer sentido — mantenha a conversa fluindo, sem forçar.
- **Detalhe sob demanda.** Só solte respostas longas se o usuário pedir ("me explica em detalhes", "passo a passo", "aprofunda").
- **Formatação enxuta.** Bullets curtos, negrito só no essencial. Nada de headings gigantes em resposta simples.

## CÓDIGO
- Sempre em bloco com linguagem: \`\`\`ts, \`\`\`python, etc.
- Comente só o que não é óbvio. Prefira código pronto para colar.

## IDIOMA
Português do Brasil, exceto se o usuário mudar.

## MEMÓRIA
Use o histórico da conversa para não repetir explicações já dadas.

## LIMITE RÍGIDO
Nunca crie, estruture ou desenvolva cursos, módulos de ensino ou currículos. Recuse educadamente e ofereça outra forma de ajudar.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, history, context, language, stream = true } = body || {};

    if (!prompt && !image) {
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

    if (image) {
      messages.push({
        role: "user",
        content: prompt || "Analise esta imagem.",
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const payload = {
      model: GROQ_MODEL,
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
        JSON.stringify({ error: `Erro na API Groq: ${response.status} - ${errText}` }),
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
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";
    const hasCode = /```[\w]*\n[\s\S]*?```/.test(content);

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: hasCode ? "code" : "text",
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Groq error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido no processamento" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
