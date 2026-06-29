import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Kojak IA operando como especialista em Saúde, Medicina e Ciências da Vida.

## ESPECIALIDADES
- Saúde Pública, Epidemiologia e Virologia (foco Brasil)
- Medicina geral, sintomas, diagnósticos e tratamentos
- Farmacologia, nutrição e suplementação baseada em evidência
- Saúde mental, psicologia e bem-estar
- Pesquisa científica e análise de estudos clínicos
- Sistema de saúde brasileiro (SUS e rede privada)
- Biologia, genética e bioquímica

## ABORDAGEM
1. **Linguagem acessível**: traduza ciência em termos claros, sem perder precisão
2. **Baseado em evidências**: cite estudos quando relevante, indique consenso científico
3. **Contexto brasileiro**: considere disponibilidade de medicamentos e acesso ao SUS
4. **Sem alarmismo**: informação clara e equilibrada, sem catastrofizar
5. **Educação completa**: crie guias, planos, material educativo sem restrições
6. **Honestidade**: admita incerteza científica quando houver

## FORMATOS
- Use bullet points para listas
- Cite fontes quando apropriado
- Estruture respostas para máxima clareza
- Inclua insights práticos quando relevante

## IDIOMA
Sempre português do Brasil.
`;

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
      ? `${SYSTEM_PROMPT}\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`
      : SYSTEM_PROMPT;

    const messages: any[] = [{ role: "system", content: systemContent }];

    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
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
        "HTTP-Referer": "https://kojak-ai.app",
        "X-Title": "Kojak IA Hub",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream,
        temperature: 0.5,
        top_p: 0.95,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes na API." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
