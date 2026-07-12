import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Kojak.AI operando como especialista em Saúde, Medicina e Ciências da Vida.

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

const TIER_SUFFIX: Record<string, string> = {
  basico: `\n\n## MODO BÁSICO ATIVO\nResponda de forma bem curta e direta: 2-4 linhas no máximo.`,
  rapido: `\n\n## MODO RÁPIDO ATIVO\nResponda de forma curta e objetiva: no máximo 4-6 linhas, a menos que o usuário peça mais detalhe explicitamente.`,
  avancado: `\n\n## MODO AVANÇADO ATIVO\nVocê pode se aprofundar: explicações completas, contexto científico, comparações e nuances quando o tema pedir.`,
  raciocinio: `\n\n## MODO RACIOCÍNIO PREMIUM ATIVO\nAnálise mais profunda possível: considere múltiplas hipóteses diagnósticas/científicas, cite evidências específicas, seja rigoroso e completo.`,
};

const MODEL_BY_TIER: Record<string, string> = {
  basico: "gemini-2.5-flash-lite",
  rapido: "gemini-2.5-flash",
  avancado: "gemini-2.5-pro",
  raciocinio: "gemini-3.1-pro",
};

const MAX_TOKENS_BY_TIER: Record<string, number> = {
  basico: 1024,
  rapido: 2048,
  avancado: 8192,
  raciocinio: 8192,
};

const DAILY_LIMIT: Record<string, number> = {
  rapido: 40,
  avancado: 10,
  raciocinio: 5,
};

const UPGRADE_MESSAGE =
  "Você atingiu o limite diário deste modo. Assine o plano Avançado por R$10/mês para uso ampliado e prioridade nas respostas. 🚀";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, history, context, stream = true, tier = "basico" } = body || {};
    const selectedTier = ["basico", "rapido", "avancado", "raciocinio"].includes(tier) ? tier : "basico";

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requiresLogin = selectedTier === "avancado" || selectedTier === "raciocinio";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin =
      SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        : null;

    // SEGURANÇA: identidade vem só do token de login (JWT), nunca do corpo da requisição.
    let verifiedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && supabaseAdmin) {
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
      if (!authError && authData?.user) {
        verifiedUserId = authData.user.id;
      }
    }

    if (requiresLogin && !verifiedUserId) {
      return new Response(
        JSON.stringify({ error: "Faça login para usar este modo.", requiresLogin: true }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = DAILY_LIMIT[selectedTier];
    if (limit && verifiedUserId && supabaseAdmin) {
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing } = await supabaseAdmin
        .from("tier_usage")
        .select("count")
        .eq("user_id", verifiedUserId)
        .eq("tier", selectedTier)
        .eq("usage_date", today)
        .maybeSingle();

      const currentCount = existing?.count ?? 0;

      if (currentCount >= limit) {
        return new Response(
          JSON.stringify({ error: UPGRADE_MESSAGE, upgradeRequired: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("tier_usage")
        .upsert(
          { user_id: verifiedUserId, tier: selectedTier, usage_date: today, count: currentCount + 1 },
          { onConflict: "user_id,tier,usage_date" }
        );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");

    const basePrompt = `${SYSTEM_PROMPT}${TIER_SUFFIX[selectedTier]}`;
    const systemContent = context && typeof context === "string" && context.trim()
      ? `${basePrompt}\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`
      : basePrompt;

    const messages: any[] = [{ role: "system", content: systemContent }];

    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: prompt });

    const requestBody: Record<string, unknown> = {
      model: MODEL_BY_TIER[selectedTier],
      messages,
      stream,
      temperature: 0.5,
      top_p: 0.95,
      max_tokens: MAX_TOKENS_BY_TIER[selectedTier],
    };

    if (selectedTier === "raciocinio") {
      requestBody.reasoning_effort = "high";
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Cota da API Gemini excedida. Verifique seu plano em aistudio.google.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erro na API Gemini: ${response.status}`);
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