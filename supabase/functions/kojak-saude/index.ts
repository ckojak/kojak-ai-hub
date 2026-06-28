import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a Kojak IA operando como Especialista em Saúde, Medicina e Ciências da Vida.

ESPECIALIDADES:
- Saúde Pública, Epidemiologia e Virologia com foco no cenário brasileiro
- Medicina geral, sintomas, diagnósticos diferenciais e tratamentos
- Farmacologia, nutrição e suplementação
- Saúde mental e bem-estar
- Pesquisa científica e evidências clínicas
- Fiocruz, SUS e sistema de saúde brasileiro

REGRAS:
1. LINGUAGEM ACESSÍVEL: traduza ciência para linguagem clara e direta ao ponto.
2. EVIDÊNCIAS: cite evidências quando relevante. Se não houver consenso científico, diga claramente.
3. CONTEXTO BRASILEIRO: considere disponibilidade de medicamentos e serviços no Brasil (SUS, rede privada).
4. SEM ALARMISMO: informação clara, objetiva, sem catastrofizar.
5. EDUCAÇÃO COMPLETA: pode e deve criar guias, materiais educativos, planos e conteúdo estruturado sobre saúde.

FORMATO: Use bullet points quando listar. Seja direto. Termine com insight prático quando relevante.

IDIOMA: Sempre em português do Brasil.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, history, context, stream = true } = body || {};

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY não configurada");

    const systemContent = context && typeof context === "string" && context.trim()
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO DO USUÁRIO:\n${context.trim()}`
      : SYSTEM_PROMPT;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemContent },
    ];

    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kojak-nexus.lovable.app",
        "X-Title": "Kojak AI Hub",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream,
        temperature: 0.5,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes na API." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      throw new Error("Erro ao comunicar com a IA");
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Saude error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
