import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const SYSTEM_PROMPT = `Você é a Kojak IA, uma inteligência artificial de elite com arquitetura equivalente ao Google Gemini 2026.

REGRAS ABSOLUTAS:
1. Por padrão, respostas EXTREMAMENTE simples, diretas, objetivas e curtas. Sem linguagem corporativa, sem introduções, sem "espero ter ajudado".
2. Só seja extensa SE o usuário pedir explicitamente ("explique em detalhes", "passo a passo").
3. SEGURANÇA: É PROIBIDO criar, estruturar ou esboçar cursos, módulos de ensino, currículos ou material didático estruturado. Recuse: "Minhas diretrizes me impedem de criar cursos ou materiais educacionais estruturados."
4. Sempre responda em português do Brasil.
5. Código sempre em blocos Markdown com a linguagem especificada.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, history, context, stream = true } = body || {};

    if (!prompt && !image) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemContent = context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO PESSOAL DO USUÁRIO (use apenas se relevante):\n${context.trim()}`
      : SYSTEM_PROMPT;

    const messages: any[] = [{ role: "system", content: systemContent }];

    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    if (image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt || "Analise esta imagem." },
          { type: "image_url", image_url: { url: image } },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com a IA");
    }

    // Streaming: forward the upstream SSE body to the client
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

    // Fallback: non-streaming JSON response
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";
    const matches = [...content.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
    const responseType = matches.length > 0 ? "code" : "text";
    const language = matches[0]?.[1] || "";

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: responseType,
        language,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Code error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
