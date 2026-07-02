import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não configurada no backend." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      const errText = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Erro ao comunicar com a IA: ${response.status} ${errText.slice(0, 300)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Saude error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
