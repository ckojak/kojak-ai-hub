import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { retrieveRelevantMemories, extractMemories } from "./memoryService.ts"; // NOVO

import {
  corsHeaders,
  GEMINI_BASE,
  geminiErrorResponse,
  geminiStreamToOpenAISSE,
  languageInstruction,
  missingKeyResponse,
  toGeminiContents,
} from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `Você é Kojak.AI, uma inteligência artificial de classe mundial, direta, precisa e extremamente capaz em múltiplos domínios.

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

const TIER_SUFFIX: Record<string, string> = {
  basico: `\n\n## MODO BÁSICO ATIVO\nResponda de forma bem curta e direta: 2-4 linhas no máximo.`,
  rapido: `\n\n## MODO RÁPIDO ATIVO\nResponda de forma curta e objetiva: no máximo 4-6 linhas, a menos que o usuário peça mais detalhe explicitamente.`,
  avancado: `\n\n## MODO AVANÇADO ATIVO\nVocê pode se aprofundar: análises completas, múltiplas alternativas, exemplos extensos quando o tema pedir.`,
  raciocinio: `\n\n## MODO RACIOCÍNIO PREMIUM ATIVO\nEste é o modo de raciocínio mais profundo disponível. Pense passo a passo em problemas complexos, considere múltiplos ângulos, e entregue a resposta mais completa e rigorosa possível.`,
};

const MODEL_BY_TIER: Record<string, string> = {
  basico: "gemini-3.1-flash-lite",
  rapido: "gemini-3.1-flash-lite",
  avancado: "gemini-3.5-flash",
  raciocinio: "gemini-3.1-pro-preview",
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      image,
      history,
      context,
      stream = true,
      tier = "basico",
      chatId, // NOVO — frontend precisa enviar
    } = body || {};

    const selectedTier = ["basico", "rapido", "avancado", "raciocinio"].includes(tier)
      ? tier
      : "basico";

    if (!prompt && !image) {
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
        JSON.stringify({
          error: "Faça login para usar este modo.",
          requiresLogin: true,
        }),
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
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada no Supabase Secrets");
    }

    const basePrompt = `${SYSTEM_PROMPT}${TIER_SUFFIX[selectedTier]}`;
    let systemContent = basePrompt;

    // NOVO: injeta contexto do usuário (se vier)
    if (context && typeof context === "string" && context.trim()) {
      systemContent += `\n\n## CONTEXTO DO USUÁRIO\n${context.trim()}`;
    }

    // NOVO: recupera memórias relevantes do usuário logado
    if (verifiedUserId && prompt) {
      const memoryContext = await retrieveRelevantMemories(prompt, verifiedUserId, 5);
      if (memoryContext) {
        systemContent += memoryContext;
      }
    }

    const messages: any[] = [{ role: "system", content: systemContent }];

    if (Array.isArray(history)) {
      for (const m of history.slice(-15)) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }

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

    const requestBody: Record<string, unknown> = {
      model: MODEL_BY_TIER[selectedTier],
      messages,
      stream,
      temperature: 0.7,
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
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento e tente novamente." }),
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

    // NOVO: extrai memórias em background (não bloqueia a resposta)
    if (verifiedUserId && chatId && history && history.length > 0) {
      const allMessages = [
        ...history.slice(-15),
        { role: "user", content: prompt || "" },
      ];
      extractMemories(allMessages, verifiedUserId, chatId).catch((e) =>
        console.error("[memory] background extract error:", e)
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