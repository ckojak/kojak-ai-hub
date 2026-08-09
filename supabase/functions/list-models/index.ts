import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const key = Deno.env.get("GEMINI_API_KEY");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": key ?? "" },
  });
  const data = await res.json();
  const names = (data?.models ?? []).map((m: any) => m.name);
  return new Response(JSON.stringify({ names }), { headers: { "Content-Type": "application/json" } });
});
