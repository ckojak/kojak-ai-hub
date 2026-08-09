import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  GEMINI_BASE,
  geminiErrorResponse,
  missingKeyResponse,
  urlToInlineData,
} from "../_shared/gemini.ts";

// Modelo leve por padrão (~3s). Qualidade máxima só sob demanda (quality: "high").
const FAST_MODEL = "gemini-3.1-flash-lite-image";
const HQ_MODEL = "gemini-3.1-flash-image";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, reference_image, quality, tier } = body || {};
    const wantsHq = ["high", "alta", "raciocinio", "avancado"].includes(
      String(quality || tier || "").toLowerCase(),
    );
    const MODEL = wantsHq ? HQ_MODEL : FAST_MODEL;

    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    const hasImage = typeof image === "string" && image.length > 100;
    const hasReference = typeof reference_image === "string" && reference_image.length > 100;

    if (!safePrompt && !hasImage && !hasReference) {
      return new Response(
        JSON.stringify({ error: "Forneça um prompt ou ao menos uma imagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return missingKeyResponse();

    const parts: any[] = [];

    if (!hasImage && !hasReference) {
      parts.push({
        text: `Crie uma imagem profissional, de alta qualidade e realista: ${safePrompt}. Ultra high resolution, photorealistic, professional quality.`,
      });
    } else if (hasReference && hasImage) {
      const target = await urlToInlineData(reference_image);
      const source = await urlToInlineData(image);
      parts.push({ text: "IMAGEM ALVO (base da composição):" });
      if (target) parts.push(target);
      parts.push({ text: "IMAGEM FONTE (extrair e aplicar no alvo):" });
      if (source) parts.push(source);
      parts.push({
        text: `Instrução: ${safePrompt || "Faça composição fotorrealista, integrando harmoniosamente o elemento principal da fonte na cena alvo."} Ultra high resolution, seamless integration, professional.`,
      });
    } else if (hasReference) {
      const ref = await urlToInlineData(reference_image);
      parts.push({ text: "Use como referência de estilo:" });
      if (ref) parts.push(ref);
      parts.push({
        text: `Crie: ${safePrompt || "Recrie em alta qualidade"} mantendo o estilo e composição da referência. Ultra high resolution.`,
      });
    } else {
      const src = await urlToInlineData(image);
      parts.push({ text: "Edite/transforme:" });
      if (src) parts.push(src);
      parts.push({
        text: `Instrução: ${safePrompt || "Melhore qualidade, detalhes e clareza."} Ultra high resolution, photorealistic.`,
      });
    }

    const response = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { imageSize: wantsHq ? "2K" : "1K" },
        },
      }),
    });

    if (!response.ok) return await geminiErrorResponse(response, "Gemini vision error:");

    const data = await response.json();
    const resultParts = data?.candidates?.[0]?.content?.parts ?? [];

    let imageUrl: string | null = null;
    let textContent = "";
    for (const part of resultParts) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (typeof part?.text === "string") {
        textContent += part.text;
      }
    }

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: imageUrl
          ? (safePrompt || "Aqui está a imagem gerada.")
          : (textContent || "Não consegui gerar a imagem."),
        type: imageUrl ? "image" : "text",
        mediaUrl: imageUrl,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Kojak Vision error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro no processamento de visão" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
