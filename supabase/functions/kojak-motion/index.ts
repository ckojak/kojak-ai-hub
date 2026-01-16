import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");

    // Inicia a geração
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "8cc2a41c06fb2a20f79fda3db25cdee70da8a0bcde0a1c6cdabec8d1b3c9dde2",
        input: { prompt, aspect_ratio: "16:9" },
      }),
    });

    const prediction = await res.json();
    
    // RETORNA IMEDIATAMENTE O ID (Evita o timeout de 60s)
    return new Response(JSON.stringify({ 
      prediction_id: prediction.id,
      status: "starting" 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
