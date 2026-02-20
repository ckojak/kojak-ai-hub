import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, image } = await req.json();

    // 1. CONEXÃO COM O COFRE (Bypass)
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
    if (!TOKEN) throw new Error("REPLICATE_API_TOKEN não encontrado no Cofre SQL.");

    // 2. DISPARO PARA O MOTOR DE MOVIMENTO
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Modelo Stable Video Diffusion XT
        version: "3f0c30e10f13010c268804c8686e0821d3f9e99214a66e16546222b31f7c1664",
        input: {
          input_image: image,
          video_length: "14_frames_with_svd_xt",
          motion_bucket_id: 127,
          frames_per_second: 6
        }
      }),
    });

    const prediction = await response.json();

    // 3. POLLING (Espera o vídeo renderizar)
    let finalData = prediction;
    while (finalData.status !== "succeeded" && finalData.status !== "failed") {
      await new Promise(r => setTimeout(r, 3000));
      const res = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${TOKEN}` }
      });
      finalData = await res.json();
    }

    if (finalData.status === "failed") throw new Error("A renderização do vídeo falhou.");

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Vídeo cinematográfico renderizado. Kojak Motion em ação.",
        type: "video",
        mediaUrl: finalData.output[0],
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no Kojak Motion:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
