import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders, GEMINI_BASE, urlToInlineData } from "../_shared/gemini.ts";

const TIMEOUT_MS = 45_000;

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
    const { prompt, image, reference_image, context } = body || {};

    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    const hasImage = typeof image === "string" && image.length > 100;
    const hasReference = typeof reference_image === "string" && reference_image.length > 100;

    if (!safePrompt && !hasImage && !hasReference) {
      return new Response(
        JSON.stringify({ error: "Forneça um prompt ou ao menos uma imagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não está configurada");
    }

    let messageContent: any;

    if (!hasImage && !hasReference) {
      messageContent = `Crie uma imagem profissional, de alta qualidade e realista: ${safePrompt}. Ultra high resolution, photorealistic, professional quality.`;
    } else {
      messageContent = [];

      if (hasReference && hasImage) {
        messageContent.push({ type: "text", text: "IMAGEM ALVO (base da composição):" });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
        messageContent.push({ type: "text", text: "IMAGEM FONTE (extrair e aplicar no alvo):" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
          type: "text",
          text: `Instrução: ${safePrompt || "Faça composição fotorrealista, integrando harmoniosamente o elemento principal da fonte na cena alvo."} Ultra high resolution, seamless integration, professional.`,
        });
      } else if (hasReference) {
        messageContent.push({ type: "text", text: "Use como referência de estilo:" });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
        messageContent.push({
          type: "text",
          text: `Crie: ${safePrompt || "Recrie em alta qualidade"} mantendo o estilo e composição da referência. Ultra high resolution.`,
        });
      } else if (hasImage) {
        messageContent.push({ type: "text", text: "Edite/transforme:" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
          type: "text",
          text: `Instrução: ${safePrompt || "Melhore qualidade, detalhes e clareza."} Ultra high resolution, photorealistic.`,
        });
      }
    }

    // Monta o body nativo do Gemini (o endpoint compat-OpenAI falha ao
    // serializar imagens geradas: "Unhandled generated data mime type: image/jpeg")
    const parts: any[] = [];
    if (typeof messageContent === "string") {
      parts.push({ text: messageContent });
    } else {
      for (const block of messageContent) {
        if (block.type === "text") parts.push({ text: block.text });
        else if (block.type === "image_url") {
          const inline = await urlToInlineData(block.image_url.url);
          if (inline) parts.push(inline);
        }
      }
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