import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  buildMessages,
  callGroq,
  groqErrorResponse,
  jsonError,
  missingKeyResponse,
  resolveTier,
  sseResponse,
} from "../_shared/groq.ts";
import { checkAndIncrementUsage, limitReachedResponse } from "../_shared/usage.ts";
import { callGeminiFallback, geminiErrorResponse, geminiStreamToOpenAISSE } from "../_shared/gemini.ts";
import { retrieveRelevantMemories, extractMemories } from "./memoryService.ts";

const SYSTEM_PROMPT = `Você é a Kojak IA — uma inteligência artificial de alto nível, parceira de raciocínio do usuário: analítica, didática e humana.

## QUEM VOCÊ É
Especialista generalista com profundidade real em engenharia de software, produto, negócios, ciência e tecnologia. Você pensa como um sênior: enxerga o problema por trás do pedido, antecipa o próximo obstáculo e entrega a solução, não só a informação.

## COMO VOCÊ RESPONDE
- **Curto por padrão, profundo sob demanda.** 1-4 frases ou bullets enxutos. Só alongue se pedirem ("detalha", "passo a passo", "aprofunda") ou se o tema exigir.
- **Didático, não catedrático.** Explique como um amigo especialista: analogia certeira + exemplo concreto.
- **Antecipe.** Se a solução tem uma pegadinha comum, avise em uma linha.
- **Dialogue.** Termine com uma pergunta curta ou próximo passo quando fizer sentido.

## CÓDIGO
- Sempre em bloco com a linguagem declarada: \`\`\`ts, \`\`\`python, etc.
- Código pronto para colar e rodar. Sem placeholders vagos.
- Comente só o que não é óbvio. Aponte o erro real quando estiver debugando, não sintomas.

## LIMITE RÍGIDO
Nunca crie, estruture ou desenvolva cursos, módulos de ensino, aulas ou currículos. Recuse educadamente e ofereça outra forma de ajudar.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      image,
      reference_image,
      history,
      context,
      mode,
      tier,
      language,
      stream = true,
      userId,
      chatId,
      webSearch,
    } = body || {};

    if (!prompt && !image) return jsonError("Prompt é obrigatório");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) return missingKeyResponse();

    const resolved = resolveTier(tier, mode);

    // Trava de uso diário gratuito (por tier, por usuário logado).
    const usage = await checkAndIncrementUsage(userId, resolved);
    if (!usage.allowed) return limitReachedResponse(usage);

    const messages = buildMessages({
      systemPrompt: SYSTEM_PROMPT,
      context,
      language,
      tier: resolved,
      history,
      prompt,
      image,
      referenceImage: reference_image,
    });

    // Injeta memórias relevantes sobre o usuário no system prompt (funciona
    // tanto pro caminho Groq quanto pro fallback Gemini, pois messages[0] é
    // compartilhado entre os dois).
    if (userId && prompt) {
      const memoryContext = await retrieveRelevantMemories(prompt, userId, 5);
      if (memoryContext) {
        messages[0].content += memoryContext;
      }
    }

    const hasImage = !!(image || reference_image);
    const useWeb = !!webSearch && !hasImage;

    let response = await callGroq({ apiKey: GROQ_API_KEY, tier: resolved, messages, stream: !!stream, hasImage, webSearch: useWeb });
    let usedGemini = false;

    // Se o modelo agente (busca na web) recusar a requisição, refaz sem web search.
    if (!response.ok && useWeb) {
      console.warn("Web search indisponível, refazendo sem busca:", response.status);
      response = await callGroq({ apiKey: GROQ_API_KEY, tier: resolved, messages, stream: !!stream, hasImage });
    }

    if (!response.ok && [429, 402, 500, 502, 503, 504].includes(response.status)) {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (GEMINI_API_KEY) {
        console.warn(`Groq falhou (${response.status}), caindo pro fallback Gemini...`);
        usedGemini = true;
        response = await callGeminiFallback(resolved, messages, GEMINI_API_KEY, !!stream);
      }
    }

    if (!response.ok) {
      return usedGemini
        ? await geminiErrorResponse(response, "Kojak Code Gemini fallback")
        : await groqErrorResponse(response, "Kojak Code Groq");
    }

    // Extrai memórias novas dessa troca, sem travar a resposta.
    if (userId && chatId && prompt) {
      const messagesForExtraction = [
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: prompt },
      ];
      extractMemories(messagesForExtraction, userId, chatId).catch((e) =>
        console.error("Erro ao extrair memórias:", e)
      );
    }

    if (stream && response.body) {
      return usedGemini ? sseResponse(geminiStreamToOpenAISSE(response.body)) : sseResponse(response.body);
    }

    const data = await response.json();
    const content = usedGemini
      ? (data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ||
          "Desculpe, não consegui processar sua solicitação.")
      : (data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.");
    const hasCode = /```[\w]*\n[\s\S]*?```/.test(content);

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: hasCode ? "code" : "text",
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Code error:", error);
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido no processamento");
  }
});