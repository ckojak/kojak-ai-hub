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
    const { prompt, image, reference_image } = await req.json();

    if (!prompt && !image && !reference_image) {
      return new Response(
        JSON.stringify({ error: "Prompt ou imagem é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    let messageContent: any = `Crie uma imagem profissional e de alta qualidade: ${prompt}. Ultra high resolution, professional photography.`;

    if (image || reference_image) {
      messageContent = [];
      
      if (reference_image) {
        messageContent.push({ type: "text", text: "Use esta imagem como ALVO base da composição:" });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
      }
      
      if (image) {
        messageContent.push({ type: "text", text: "Use esta imagem como FONTE (ex: extrair o rosto/elemento e aplicar no alvo):" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
      }

      messageContent.push({ 
        type: "text", 
        text: `Instrução estrita de edição: ${prompt || 'Faça a fusão realista destas imagens.'} Ultra high resolution, photorealistic blending, seamless integration.` 
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: messageContent }
        ],
        modalities: ["image", "text"],
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
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao processar as imagens na IA");
    }

    const data = await response.json();
    
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = data.choices?.[0]?.message?.content || "Edição concluída com sucesso!";

    if (!imageData) {
      throw new Error("A IA processou, mas não retornou a imagem final.");
    }

    const result = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: textContent,
      type: "image",
      mediaUrl: imageData,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
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
