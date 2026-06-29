import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Múltiplas queries para garantir que o projeto fica ativo
    const queries = [
      supabase.from("profiles").select("count", { count: "exact" }).limit(1),
      supabase.from("chats").select("count", { count: "exact" }).limit(1),
      supabase.from("activity_log").select("count", { count: "exact" }).limit(1),
    ];

    const results = await Promise.all(queries);
    const allSuccess = results.every((r) => !r.error);

    if (!allSuccess) {
      const errors = results.filter((r) => r.error).map((r) => r.error?.message);
      throw new Error(`Erros nas queries: ${errors.join(", ")}`);
    }

    const now = new Date().toISOString();
    console.log(`[keep-alive] ✅ Supabase mantido ativo em ${now}`);

    // Log da atividade
    await supabase.from("activity_log").insert({
      user_id: null,
      action: "keep_alive",
      details: { timestamp: now, type: "auto_ping" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Supabase mantido ativo com sucesso",
        timestamp: now,
        queriesExecuted: 3,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[keep-alive] ❌ Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
