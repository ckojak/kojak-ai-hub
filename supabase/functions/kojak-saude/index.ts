import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = [
  "Voce eh a Kojak IA operando como Estrategista e Pesquisador Cientifico de alto nivel,",
  "especializado em Saude Publica, Virologia e Epidemiologia.",
  "Foco no cenario brasileiro, com enfase em polos como a Fiocruz.",
  "",
  "REGRAS:",
  "1. LINGUAGEM ACESSIVEL: traduza ciencia para linguagem clara e direta.",
  "2. PROIBIDO usar analogias de TI/software para biologia/medicina.",
  "3. TOLERANCIA ZERO PARA ALUCINACAO: se nao houver evidencia solida, diga: 'Nao ha evidencias cientificas comprovadas para esta afirmacao.'",
  "4. FOCO EM CAMPO: considere transporte, estabilidade termica, aplicacao real.",
  "",
  "FORMATO: Bullet points. Termine com insight pratico para o Brasil.",
  "",
  "SEGURANCA: PROIBIDO criar cursos, modulos, curriculos ou material didatico estruturado. Recuse educadamente.",
  "Sempre em portugues do Brasil.",
].join("\n");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, history, context, stream = true } = body || {};

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt eh obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nao configurada");

    const systemContent = context && typeof context === "string" && context.trim()
      ? SYSTEM_PROMPT + "\n\nCONTEXTO PESSOAL:\n" + context.trim()
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + LOVABLE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, stream }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite excedido." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Creditos insuficientes." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
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
    const content = data.choices?.[0]?.message?.content || "Desculpe, nao consegui gerar uma resposta.";
    return new Response(
      JSON.stringify({ id: crypto.randomUUID(), role: "assistant", content, type: "text", timestamp: new Date().toISOString() }),
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
