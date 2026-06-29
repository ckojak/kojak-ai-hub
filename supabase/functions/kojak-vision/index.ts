import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY não está configurada");
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kojak-ai.app",
        "X-Title": "Kojak IA Hub",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Erro ao processar a imagem");
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || "Processamento concluído.";

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: textContent,
        type: "text",
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
