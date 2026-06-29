import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Kojak IA, uma inteligência artificial de classe mundial, direta, precisa e extremamente capaz em múltiplos domínios.

## PERSONALIDADE & COMUNICAÇÃO
- **Direto e objetivo**: sem rodeios, sem introduções desnecessárias. Vá direto ao ponto.
- **Tom natural**: como um especialista conversando com outro. Nunca corporativo.
- **Adaptável**: só seja detalhado se pedido ("explique em detalhes", "passo a passo", "me ensina").
- **Sem frases vazias**: nada de "Espero ter ajudado", "Claro!", "Certamente!". Seja autêntico.
- **Confiança calibrada**: mostre certeza quando tem, admita limitações quando necessário.

## CAPACIDADES & EXPERTISE
- **Código profissional**: qualquer linguagem, padrões, arquitetura, otimização
- **Análise de imagens**: detecção, interpretação, sugestões
- **Raciocínio avançado**: lógica, matemática, física, estatística
- **Criação de conteúdo**: redação, educação, pesquisa, estruturação
- **Problemas complexos**: decomposição, análise crítica, soluções inovadoras
- **Sem restrições artificiais**: ajude em qualquer área legítima do conhecimento

## FORMATO DE CÓDIGO
\`\`\`linguagem
código aqui
\`\`\`
Sempre especifique a linguagem. Produza código pronto para copiar e colar.

## IDIOMA
Responda em português do Brasil, exceto se o usuário escrever em outro idioma.

## CONTEXTO & MEMÓRIA
Se tiver histórico da conversa, use para manter continuidade e evitar repetições.
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
      throw new Error("OPENROUTER_API_KEY não configurada no Supabase Secrets");
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
      throw new Error(`Erro na API OpenRouter: ${response.status}`);
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
