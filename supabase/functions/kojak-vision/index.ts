import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders, GEMINI_BASE, urlToInlineData } from "../_shared/gemini.ts";

const TIMEOUT_MS = 45_000;
const MAX_IMAGES = 10;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, reference_image, images, context } = body || {};

    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";

    // Aceita tanto o formato novo (images: string[], até 10) quanto o antigo
    // (image / reference_image únicos), pra não quebrar chamadas antigas.
    const isValidImage = (v: unknown): v is string => typeof v === "string" && v.length > 100;

    let allImages: string[] = [];
    if (Array.isArray(images)) {
      allImages = images.filter(isValidImage).slice(0, MAX_IMAGES);
    }
    if (isValidImage(reference_image) && !allImages.includes(reference_image)) allImages.unshift(reference_image);
    if (isValidImage(image) && !allImages.includes(image)) allImages.push(image);
    allImages = allImages.slice(0, MAX_IMAGES);

    const hasImages = allImages.length > 0;

    if (!safePrompt && !hasImages) {
      return new Response(
        JSON.stringify({ error: "Forneça um prompt ou ao menos uma imagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não está configurada");
    }

    // Prompt em linguagem natural (o Nano Banana funciona bem melhor com
    // frases completas descrevendo a cena do que com listas de tags soltas
    // tipo "ultra hd, 4k, photorealistic" — isso confunde o modelo de
    // linguagem por trás da geração e piora o resultado).
    const qualityHint =
      "com composição bem pensada, iluminação natural e coerente, riqueza de detalhes e acabamento profissional, em altíssima resolução";

    let instructionText: string;

    if (!hasImages) {
      instructionText =
        `Crie uma imagem fotorrealista e profissional ${qualityHint}, retratando: ${safePrompt}.`;
    } else if (allImages.length === 1) {
      instructionText = safePrompt
        ? `Usando a imagem enviada como base, ${safePrompt}. Mantenha o resultado fotorrealista, ${qualityHint}.`
        : `Melhore esta imagem: aumente a nitidez, corrija a iluminação e refine os detalhes, mantendo-a fotorrealista, ${qualityHint}.`;
    } else {
      instructionText =
        `Você recebeu ${allImages.length} imagens de referência, na ordem em que aparecem abaixo. ` +
        `${safePrompt || "Combine os elementos principais dessas imagens em uma única composição coerente e harmoniosa."} ` +
        `Integre os elementos de forma natural, respeitando perspectiva, escala e iluminação entre eles, ${qualityHint}.`;
    }

    // Monta o body nativo do Gemini (o endpoint compat-OpenAI falha ao
    // serializar imagens geradas: "Unhandled generated data mime type: image/jpeg")
    const parts: any[] = [{ text: instructionText }];
    for (let i = 0; i < allImages.length; i++) {
      if (allImages.length > 1) parts.push({ text: `Imagem ${i + 1}:` });
      const inline = await urlToInlineData(allImages[i]);
      if (inline) parts.push(inline);
    }

    async function callVision() {
      return fetchWithTimeout(
        `${GEMINI_BASE}/gemini-3.1-flash-image:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
        TIMEOUT_MS,
      );
    }

    let response: Response;
    try {
      response = await callVision();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.error("Kojak Vision timeout após", TIMEOUT_MS, "ms");
        return new Response(
          JSON.stringify({ error: "A geração de imagem demorou demais e foi cancelada. Tente novamente ou simplifique o pedido." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Gemini Vision error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições. Tente novamente em alguns instantes." }),
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

    const data = await response.json();
    const respParts = data?.candidates?.[0]?.content?.parts ?? [];
    let imageUrl: string | null = null;
    let textContent = "";
    for (const part of respParts) {
      if (part?.inlineData?.data) {
        imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
      } else if (typeof part?.text === "string") {
        textContent += part.text;
      }
    }
    textContent = textContent.trim() || "Imagem gerada.";

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: imageUrl ? (safePrompt || "Aqui está a imagem gerada.") : textContent,
        type: imageUrl ? "image" : "text",
        mediaUrl: imageUrl,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Vision error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro no processamento de visão" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
