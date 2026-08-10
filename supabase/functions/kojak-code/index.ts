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
    const { prompt, image, reference_image, history, context, mode, tier, language, stream = true } = body || {};

    if (!prompt && !image) return jsonError("Prompt é obrigatório");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) return missingKeyResponse();

    const resolved = resolveTier(tier, mode);
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

    const hasImage = !!(image || reference_image);
    const response = await callGroq({ apiKey: GROQ_API_KEY, tier: resolved, messages, stream: !!stream, hasImage });

    if (!response.ok) return await groqErrorResponse(response, "Kojak Code Groq");

    if (stream && response.body) return sseResponse(response.body);

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Code error:", error);
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido no processamento");
  }
});
