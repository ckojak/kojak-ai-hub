import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, image, reference_image, context } = body || {};

    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    const hasImage = typeof image === "string" && image.length > 0;
    const hasReference = typeof reference_image === "string" && reference_image.length > 0;

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

    // Monta o conteúdo da mensagem baseado no que foi enviado
    let messageContent: any;

    if (!hasImage && !hasReference) {
      // Geração pura por texto
      messageContent = `Crie uma imagem profissional e de alta qualidade: ${safePrompt}. Ultra high resolution, professional photography, detailed.`;
    } else {
      messageContent = [];

      if (hasReference && hasImage) {
        // Composição entre 2 imagens
        messageContent.push({ type: "text", text: "IMAGEM ALVO (base da composição):" });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
        messageContent.push({ type: "text", text: "IMAGEM FONTE (extrair elemento e aplicar no alvo):" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
          type: "text",
          text: `Instrução: ${safePrompt || "Faça a fusão fotorrealista das imagens, mantendo a composição da imagem ALVO e integrando o elemento principal da imagem FONTE."} Ultra high resolution, photorealistic blending, seamless integration.`,
        });
      } else if (hasReference) {
        // Geração com imagem de referência
        messageContent.push({ type: "text", text: "Use esta imagem como referência base:" });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
        messageContent.push({
          type: "text",
          text: `Crie uma nova cena mantendo o estilo e composição da referência. Instrução: ${safePrompt || "Recrie em alta qualidade."} Ultra high resolution.`,
        });
      } else if (hasImage) {
        // Edição de imagem enviada
        messageContent.push({ type: "text", text: "Edite/transforme esta imagem:" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
          type: "text",
          text: `Instrução: ${safePrompt || "Melhore qualidade e detalhes."} Ultra high resolution, photorealistic.`,
        });
      }
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kojak-nexus.lovable.app",
        "X-Title": "Kojak AI Hub",
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
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes na API." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      throw new Error("Erro ao processar a imagem na IA");
    }

    const data = await response.json();

    // Tenta extrair imagem gerada (se o modelo suportar)
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = data.choices?.[0]?.message?.content || "Processamento concluído.";

    if (imageData) {
      return new Response(
        JSON.stringify({
          id: crypto.randomUUID(),
          role: "assistant",
          content: textContent,
          type: "image",
          mediaUrl: imageData,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: retorna análise textual da imagem
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro crítico no motor de visão." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
