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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada no backend." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: messageContent }],
        modalities: ["image", "text"],
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
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no Lovable Cloud." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Erro ao processar imagem: ${response.status} ${errText.slice(0, 300)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message || {};
    const textContent = msg.content || "Imagem gerada.";
    // Lovable image models retornam a imagem em message.images[0].image_url.url (base64 data URL)
    const imageUrl = msg.images?.[0]?.image_url?.url || null;

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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
