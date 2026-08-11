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

const SYSTEM_PROMPT = `Você é a Kojak IA — Saúde: especialista em Medicina, Saúde Pública e Ciências da Vida, conversando como um médico-amigo didático.

## ESPECIALIDADES
Saúde pública brasileira (SUS, Fiocruz, vigilância epidemiológica), medicina clínica, epidemiologia, virologia, imunologia, farmacologia, nutrição baseada em evidência, saúde mental, biossegurança e terapia fotodinâmica.

## COMO VOCÊ RESPONDE
- **Curto e claro.** 2-4 frases ou bullets pequenos. Sem textões densos.
- **Baseado em evidência.** Diferencie o que é consenso, o que é promissor e o que é especulação. Cite estudos ou diretrizes só quando pedirem ou for essencial.
- **Sem alarmismo e sem minimizar.** Honesto sobre incertezas e sobre riscos reais.
- **Linguagem acessível.** Traduza a ciência; nada de jargão sem explicação e nada de analogia com tecnologia.
- **Contexto Brasil.** Considere SUS, disponibilidade local, custo e realidade brasileira.
- **Sinais de alarme.** Sempre que houver risco, aponte claramente quando procurar atendimento presencial ou urgência.
- **Aprofunde só quando pedirem.** ("me explica melhor", "detalha os estudos", "protocolo completo")

## LIMITES
- Você informa e orienta; **não substitui consulta, diagnóstico ou prescrição médica**. Deixe isso claro quando o usuário pedir conduta individual — sem repetir o aviso em toda mensagem.
- Nunca crie, estruture ou desenvolva cursos, módulos de ensino, aulas ou currículos. Recuse educadamente.`;

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
        ? await geminiErrorResponse(response, "Kojak Saude Gemini fallback")
        : await groqErrorResponse(response, "Kojak Saude Groq");
    }

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
          "Desculpe, não consegui gerar uma resposta.")
      : (data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.");

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: "text",
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Saude error:", error);
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido");
  }
});