import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. EXTRAÇÃO CIRÚRGICA: Agora pegamos o Alvo (Jet Ski) e a Fonte (Seu Rosto)
    const { prompt, image, reference_image } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: config } = await supabase
      .from("_kojak_configs")
      .select("value")
      .eq("key", "REPLICATE_API_TOKEN")
      .single();

    const TOKEN = config?.value;
    if (!TOKEN) throw new Error("REPLICATE_API_TOKEN não encontrado no Cofre.");

    let predictionBody;

    // 2. LÓGICA DE ELITE (FACE SWAP VS GERAÇÃO)
    if (image && reference_image) {
      // PROTOCOLO NANO BANANA: Troca de rosto real (InsightFace)
      // Não "desenha" um rosto parecido, ele TRANSPLANTA os seus traços no alvo.
      predictionBody = {
        version: "9a49903ca735412497645ef598177df3413550e640375681e18b1a8f9069d301",
        input: {
          target_image: reference_image, // O Jet Ski
          swap_image: image,             // O seu rosto
        }
      };
    } else {
      // GERAÇÃO DE ALTA FIDELIDADE: Flux.1 Dev
      predictionBody = {
        version: "39226161858c3042050414f52643a60a72c1c36f920f18820c763327d53086e3",
        input: { 
          prompt: prompt || "Professional 8k photography",
          aspect_ratio: "1:1",
          guidance_scale: 3.5
        }
      };
    }

    // 3. DISPARO PARA O REPLICATE
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(predictionBody),
    });

    const prediction = await response.json();

    // 4. POLLING (Espera a imagem ficar pronta)
    let finalData = prediction;
    while (finalData.status !== "succeeded" && finalData.status !== "failed") {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${TOKEN}` }
      });
      finalData = await res.json();
    }

    if (finalData.status === "failed") throw new Error("A IA falhou em processar a imagem.");

    const mediaUrl = Array.isArray(finalData.output) ? finalData.output[0] : finalData.output;

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: image && reference_image ? "Troca de rosto realizada com precisão. Kojak Vision entregando o melhor." : "Imagem gerada com sucesso.",
        type: "image",
        mediaUrl: mediaUrl,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no Kojak Vision:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
