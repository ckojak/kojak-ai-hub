import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "Motion requer REPLICATE_API_TOKEN no Supabase Secrets. Acesse replicate.com para obter uma chave.",
          requiresSetup: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[kojak-motion] Iniciando: "${prompt.slice(0, 80)}..."`);

    // Inicia geração no Replicate (auth: Token conforme padrão Replicate)
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "8cc2a41c06fb2a20f79fda3db25cdee70da8a0bcde0a1c6cdabec8d1b3c9dde2",
        input: {
          prompt: prompt.trim(),
          aspect_ratio: "16:9",
          loop: false,
          num_frames: 97,
          num_inference_steps: 40,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text().catch(() => "");
      console.error("Replicate error:", createResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Replicate ${createResponse.status}: ${errorText.slice(0, 300)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await createResponse.json();
    console.log(`[kojak-motion] Prediction ID: ${prediction.id}`);

    // Polling até completar
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 120;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });

      if (!statusResponse.ok) throw new Error("Erro ao verificar status");

      result = await statusResponse.json();
      attempts++;
      console.log(`[kojak-motion] Status: ${result.status} (${attempts}/${maxAttempts})`);
    }

    if (result.status === "failed") {
      throw new Error(result.error || "Falha na geração");
    }
    if (result.status !== "succeeded") {
      throw new Error("Timeout na geração (10 minutos)");
    }

    const videoUrl = result.output;
    console.log(`[kojak-motion] ✅ Vídeo pronto!`);

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Vídeo gerado com sucesso!",
        type: "video",
        mediaUrl: videoUrl,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Motion error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro na geração de vídeo" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
