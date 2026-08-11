// Trava de uso diário gratuito por tier.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { Tier } from "./groq.ts";
import { corsHeaders } from "./groq.ts";

export const DAILY_LIMITS: Record<Tier, number> = {
  basico: 50,
  rapido: 30,
  avancado: 12,
  raciocinio: 6,
};

export const UPGRADE_MESSAGE =
  "Você atingiu o limite diário gratuito. Assine o Premium por $15/mês pra uso ampliado — fale comigo pelo WhatsApp: +55 21 97993-4676";

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * Verifica o limite diário do tier e incrementa o contador.
 * Usuários deslogados não são contabilizados (não há user_id).
 * Em caso de falha na infraestrutura, libera a requisição (fail-open).
 */
export async function checkAndIncrementUsage(
  userId: string | null | undefined,
  tier: Tier,
): Promise<UsageResult> {
  const limit = DAILY_LIMITS[tier] ?? 30;
  if (!userId) return { allowed: true, used: 0, limit };

  const supabase = serviceClient();
  if (!supabase) return { allowed: true, used: 0, limit };

  const usage_date = today();

  try {
    const { data, error } = await supabase
      .from("tier_usage")
      .select("id, count")
      .eq("user_id", userId)
      .eq("tier", tier)
      .eq("usage_date", usage_date)
      .maybeSingle();

    if (error) {
      console.error("tier_usage select error:", error.message);
      return { allowed: true, used: 0, limit };
    }

    const used = data?.count ?? 0;
    if (used >= limit) return { allowed: false, used, limit };

    if (data) {
      await supabase.from("tier_usage").update({ count: used + 1 }).eq("id", data.id);
    } else {
      await supabase.from("tier_usage").insert({ user_id: userId, tier, usage_date, count: 1 });
    }

    return { allowed: true, used: used + 1, limit };
  } catch (e) {
    console.error("tier_usage error:", e);
    return { allowed: true, used: 0, limit };
  }
}

export function limitReachedResponse(result: UsageResult) {
  return new Response(
    JSON.stringify({
      error: UPGRADE_MESSAGE,
      upgradeRequired: true,
      limit: result.limit,
      used: result.used,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
