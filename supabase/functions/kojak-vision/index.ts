```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2.38.4";

// Define os cabeçalhos CORS para permitir requisições de qualquer origem.
// Isso é comum para APIs públicas ou em desenvolvimento.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inicia o servidor HTTP do Deno para lidar com as requisições.
serve(async (req) => {
  // Trata requisições OPTIONS (preflight CORS) respondendo com os cabeçalhos CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extrai o prompt e a imagem do corpo da requisição JSON.
    const { prompt, image } = await req.json();

    // Validação básica: garante que o prompt foi fornecido.
    if (!prompt) {
      return new Response(JSON.stringify({ error: "O 'prompt' é obrigatório." }), {
        status: 400, // Bad Request
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inicializa o cliente Supabase usando variáveis de ambiente.
    // É crucial que 'SUPABASE_URL' e 'SUPABASE_SERVICE_ROLE_KEY' estejam configuradas no ambiente.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", // Se não houver, será uma string vazia (lançará erro no createClient).
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // O mesmo aqui.
    );

    // Busca o token da API Replicate no Supabase.
    // O uso de `_kojak_configs` é uma boa prática para armazenar configurações sensíveis/dinâmicas.
    const { data: config, error: configError } = await supabase
      .from("_kojak_configs")
      .select("value")
      .eq("key", "REPLICATE_API_TOKEN")
      .single();

    if (configError) {
      console.error("Erro ao buscar REPLICATE_API_TOKEN do Supabase:", configError.message);
      throw new Error(`Falha ao obter token de configuração: ${configError.message}`);
    }

    const TOKEN = config?.value;
    if (!TOKEN) {
      throw new Error("REPLICATE_API_TOKEN não configurado no Supabase.");
    }

    let inputBody: any; // Tipo any para flexibilidade, mas idealmente mais específico.
    let version: string; // Versão do modelo Replicate.

    // Lógica condicional para escolher o modelo e os parâmetros de entrada
    // com base na presença de uma imagem (modo ID preservation ou texto puro).
    if (image) {
      // --- PROTOCOLO ONE-SHOT IDENTITY (NÍVEL NANO BANANA) ---
      // Modelo: PuLID-Flux-v0.2 (O topo da cadeia alimentar atual para preservação de identidade)
      version = "4004c8404494c25d80b431777d1ca4e24016e7886a877a505b33107576a26dfa";
      inputBody = {
        face_image: image,
        prompt: `A high-quality, professional 8k photo of the person in the reference image, ${prompt}. Photorealistic, cinematic lighting, sharp focus, 8k resolution.`,
        guidance_scale: 4, // Controla quão estritamente o modelo segue o prompt.
        id_weight: 1.0,    // Força total na identidade - crucial para PuLID.
        num_steps: 30      // Número de passos de inferência.
      };
    } else {
      // Geração de elite por texto (Flux Dev - modelo de alta qualidade apenas por texto)
      version = "39226161858c3042050414f52643a60a72c1c36f920f18820c763327d53086e3";
      inputBody = {
        prompt: prompt,
        aspect_ratio: "1:1", // Proporção da imagem (quadrada).
        guidance_scale: 3.5  // Ajuste o guidance_scale para o modelo text-to-image.
      };
    }

    // Envia a requisição para a API de predições do Replicate.
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${TOKEN}`, // Autenticação com o token Replicate.
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ version, input: inputBody }),
    });

    // Verifica se a requisição inicial ao Replicate foi bem-sucedida.
    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Erro na requisição inicial ao Replicate:", errorBody);
      throw new Error(`Falha na API Replicate: ${errorBody.detail || response.statusText}`);
    }

    const prediction = await response.json();

    // Polling (Espera a mágica acontecer):
    // O Replicate retorna um status "starting" ou "processing" e um ID.
    // Precisamos de polling para verificar o status da predição até que ela termine.
    let finalData = prediction;
    // O timeout para o polling (`setTimeout`) deve ser ajustado conforme a latência esperada.
    // 2 segundos é um bom ponto de partida.
    while (finalData.status !== "succeeded" && finalData.status !== "failed" && finalData.status !== "canceled") {
      await new Promise(r => setTimeout(r, 2000)); // Espera 2 segundos.
      const res = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${TOKEN}` }
      });

      if (!res.ok) {
        throw new Error(`Falha no polling da API Replicate: ${res.statusText}`);
      }
      finalData = await res.json();
    }

    // Se a predição final falhou, lança um erro.
    if (finalData.status === "failed") {
      throw new Error("A IA falhou na geração: " + (finalData.error || "motivo desconhecido"));
    }
    // Caso seja cancelada, também tratamos como falha.
    if (finalData.status === "canceled") {
        throw new Error("A geração de IA foi cancelada.");
    }

    // Retorna a resposta bem-sucedida com os dados da imagem gerada.
    // O `mediaUrl` é tratado como um array (comum em alguns modelos) ou string simples.
    return new Response(
      JSON.stringify({
        id: crypto.randomUUID(), // Gera um ID único para a resposta.
        role: "assistant",       // Indica que a resposta vem de um assistente de IA.
        content: image
          ? "Identidade reconhecida. Cena gerada com preservação de face."
          : "Imagem gerada por IA.",
        type: "image",
        mediaUrl: Array.isArray(finalData.output) ? finalData.output[0] : finalData.output,
        timestamp: new Date().toISOString(), // Adiciona um timestamp.
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    // Captura e loga quaisquer erros que ocorram durante o processo.
    console.error("Erro na requisição:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, // Internal Server Error
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```