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
          error: "O modo Motion requer a chave REPLICATE_API_TOKEN configurada no Supabase. Vá em Project Settings → Edge Functions → Secrets e adicione sua chave do replicate.com",
          requiresSetup: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[kojak-motion] Iniciando geração de vídeo: "${prompt.slice(0, 80)}..."`);

    // Inicia a geração do vídeo no Replicate
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "8cc2a41c06fb2a20f79fda3db25cdee70da8a0bcde0a1c6cdabec8d1b3c9dde2",
        input: {
          prompt: prompt.trim(),
          aspect_ratio: "16:9",
          loop: false,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Replicate create error:", createResponse.status, errorText);
      throw new Error("Erro ao iniciar geração de vídeo no Replicate");
    }

    const prediction = await createResponse.json();
    console.log(`[kojak-motion] Prediction ID: ${prediction.id}`);

    // Polling até completar (máximo 10 minutos)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 120; // 120 x 5s = 10 minutos

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });

      if (!statusResponse.ok) throw new Error("Erro ao verificar status do vídeo");

      result = await statusResponse.json();
      attempts++;
      console.log(`[kojak-motion] Status: ${result.status} (tentativa ${attempts}/${maxAttempts})`);
    }

    if (result.status === "failed") {
      throw new Error(result.error || "Falha na geração do vídeo");
    }
    if (result.status !== "succeeded") {
      throw new Error("Tempo limite excedido na geração do vídeo (10 minutos)");
    }

    const videoUrl = result.output;
    console.log(`[kojak-motion] Vídeo gerado com sucesso!`);

    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Vídeo gerado com sucesso! Confira o resultado abaixo:",
        type: "video",
        mediaUrl: videoUrl,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Motion error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
