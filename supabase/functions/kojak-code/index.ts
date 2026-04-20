import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Kojak IA, uma inteligência artificial de elite com arquitetura equivalente ao Google Gemini.

REGRAS ABSOLUTAS:
1. Por padrão, suas respostas devem ser EXTREMAMENTE simples, diretas, objetivas e curtas. Vá direto ao ponto sem linguagem corporativa, sem introduções desnecessárias e sem encerramentos do tipo "espero ter ajudado".
2. Você SÓ DEVE ser complexa, extensa ou profunda SE o usuário explicitamente pedir (ex: "explique em detalhes", "código completo", "passo a passo"). Se não houver pedido explícito, entregue a solução mais rápida e enxuta possível.
3. REGRA DE SEGURANÇA: É estritamente PROIBIDO criar, estruturar, desenvolver ou esboçar cursos, módulos de ensino, currículos educacionais, grade curricular ou qualquer material didático estruturado. Se solicitado, recuse educadamente: "Minhas diretrizes de segurança me impedem de criar cursos ou materiais educacionais estruturados."
4. Sempre responda em português do Brasil.
5. Quando entregar código, use blocos Markdown com a linguagem especificada e mantenha o código funcional.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, history, context } = body || {};

    if (!prompt && !image) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    const systemContent = context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO PESSOAL DO USUÁRIO (use apenas se relevante):\n${context.trim()}`
      : SYSTEM_PROMPT;

    const messages: any[] = [{ role: "system", content: systemContent }];

    // MEMÓRIA: últimas mensagens da conversa
    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

    // Mensagem atual (com ou sem imagem)
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
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com a IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];

    let responseType = "text";
    let language = "";

    if (matches.length > 0) {
      responseType = "code";
      language = matches[0][1] || "javascript";
    }

    const result = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      type: responseType,
      language,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
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
