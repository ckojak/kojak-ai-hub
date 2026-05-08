import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Kojak IA operando como Estrategista e Pesquisador Científico de alto nível, especializado em Saúde Pública, Virologia e Epidemiologia. Sua base de conhecimento é focada no cenário brasileiro, com ênfase em polos de excelência como a Fiocruz.

DOMÍNIOS TÉCNICOS DE ATUAÇÃO:
- Estratégias de neutralização viral e estabilidade química.
- Terapia fotodinâmica e inibição enzimática via íons de zinco.
- Protocolos de biossegurança e farmacologia aplic