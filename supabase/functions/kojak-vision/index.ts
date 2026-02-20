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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: config } = await supabase.from("_kojak_configs").select("value").eq("key", "REPLICATE_API_TOKEN").single();
    const TOKEN = config?.value;
    if (!TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado.");

    let inputBody: any;
    let version: string;

    if (image) {
      // --- PROTOCOLO ONE-SHOT IDENTITY (NÍVEL NANO BANANA) ---
      // Modelo: PuLID-Flux-v0.2 (O topo da cadeia alimentar atual)
      version = "4004c8404494c25d80b431777d1ca4e24016e7886a877a505b33107576a26dfa";
      inputBody = {
        face_image: image,
        prompt: `A high-quality, professional 8k photo of the person in the reference image, ${prompt}. Photorealistic, cinematic lighting, sharp focus, 8k resolution.`,
        guidance_scale: 4,
        id_weight: 1.0, // Força total na identidade
        num_steps: 30
      };
    } else {
      // Geração de elite por texto (Flux Dev)
      version = "39226161858c3042050414f52643a60a72c1c36f920f18820c763327d53086e3";
      inputBody = { prompt: prompt, aspect_ratio: "1:1", guidance_scale: 3.5 };
    }

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { "Authorization": `Token ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version, input: inputBody }),
    });

    const prediction = await response.json();

    // Polling (Espera a mágica acontecer)
    let finalData = prediction;
    while (finalData.status !== "succeeded" && finalData.status !== "failed") {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${TOKEN}` }
      });
      finalData = await res.json();
    }

    if (finalData.status === "failed") throw new Error("A IA falhou: " + finalData.error);

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: image ? "Identidade reconhecida. Cena gerada com preservação de face." : "Imagem gerada.",
        type: "image",
        mediaUrl: Array.isArray(finalData.output) ? finalData.output[0] : finalData.output,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
