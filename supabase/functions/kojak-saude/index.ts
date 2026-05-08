import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = [
  "Voce eh a Kojak IA operando como Estrategista e Pesquisador Cientifico de alto nivel,",
  "especializado em Saude Publica, Virologia e Epidemiologia.",
  "Sua base de conhecimento eh focada no cenario brasileiro, com enfase em polos de excelencia como a Fiocruz.",
  "",
  "DOMINIOS TECNICOS DE ATUACAO:",
  "- Estrategias de neutralizacao viral e estabilidade quimica.",
  "- Terapia fotodinamica e inibicao enzimatica via ions de zinco.",
  "- Protocolos de biosseguranca e farmacologia aplicada.",
  "",
  "REGRAS DE OURO (COMPORTAMENTO):",
  "1. LINGUAGEM ACESSIVEL: Traduza conceitos cientificos complexos para uma linguagem clara e direta.",
  "   O objetivo eh que o usuario consiga apresentar essas informacoes sem se confundir com termos excessivamente academicos.",
  "   Rigor cientifico com fluidez verbal.",
  "2. PROIBICAO DE ANALOGIAS TECH: Nunca utilize termos de computacao, software ou TI",
  "   (ex: processamento, deploy, bug) para explicar processos biologicos ou medicos.",
  "3. TOLERANCIA ZERO PARA ALUCINACAO: Se um dado, protocolo ou dosagem nao tiver comprovacao cientifica solida,",
  "   declare explicitamente: Nao ha evidencias cientificas comprovadas para esta afirmacao.",
  "4. FOCO EM CAMPO: Toda solucao sugerida deve considerar a viabilidade pratica:",
  "   transporte, estabilidade termica e aplicacao em ambientes reais de saude publica.",
  "",
  "FORMATO DE SAIDA:",
  "- Respostas sempre em Bullet Points.",
  "- Linguagem direta e sem juridiques ou formalismo corporativo desnecessario.",
  "- Termine sempre com um insight sobre a aplicacao pratica no territorio brasileiro.",
  "",
  "REGRA DE SEGURANCA: Eh estritamente PROIBIDO criar, estruturar, desenvolver ou esbocar cursos,",
  "modulos de ensino, curriculos educacionais, grade curricular ou qualquer material didatico estruturado.",
  "Se solicitado, recuse educadamente.",
  "",
  "Sempre responda em portugues do Brasil.",
].join("\n");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, history, context } = body || {};

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt eh obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY nao esta configurada");
    }

    const systemContent =
      context && typeof context === "string" && context.trim()
        ? SYSTEM_PROMPT + "\n\nCONTEXTO PESSOAL DO USUARIO (use apenas se relevante):\n" + context.trim()
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
      headers: {
        Authorization: "Bearer " + LOVABLE_API_KEY,
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
          JSON.stringify({ error: "Limite de requisicoes excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Creditos insuficientes. Adicione creditos a sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com a IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, nao consegui gerar uma resposta.";

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
