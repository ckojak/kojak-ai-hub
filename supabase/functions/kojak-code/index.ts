import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
`;

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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não configurada no backend." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // System prompt com contexto pessoal
    const systemContent = context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`
      : SYSTEM_PROMPT;

    const messages: any[] = [{ role: "system", content: systemContent }];

    // Histórico (últimas 15 mensagens para contexto melhor)
    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    // Mensagem com ou sem imagem
    if (image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt || "Analise esta imagem e descreva o que vê." },
          { type: "image_url", image_url: { url: image, detail: "high" } },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kojak-ai.app",
        "X-Title": "Kojak IA Hub",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 8192,
        presence_penalty: 0,
        frequency_penalty: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes na API. Verifique sua conta no OpenRouter." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Erro na API OpenRouter: ${response.status} ${errorText.slice(0, 300)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Streaming SSE
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

    // Resposta não-streaming
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Code error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido no processamento" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
