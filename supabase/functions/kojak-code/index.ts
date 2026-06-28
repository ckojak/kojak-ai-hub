// supabase/functions/kojak-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, image, history, context, stream = true } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("API_KEY ausente no ambiente");

    // Definição do prompt e mensagens
    const systemContent = `${SYSTEM_PROMPT}\n\nCONTEXTO:\n${context || ""}`;
    const messages = [{ role: "system", content: systemContent }, ...(history || []).slice(-10)];
    
    if (image) {
      messages.push({ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    // Call com Timeout de 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kojak-nexus.lovable.app",
        "X-Title": "Kojak IA",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash", // MODELO CORRIGIDO
        messages,
        stream,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter falhou: ${response.status} - ${errorData}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": stream ? "text/event-stream" : "application/json" },
    });

  } catch (error) {
    console.error("Erro Kojak IA:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

const SYSTEM_PROMPT = `Você é a Kojak IA. Resposta objetiva, técnica e direta. Sem rodeios.`;
