import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Constantes
const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const LUMA_RAY_MODEL_VERSION = "8cc2a41c06fb2a20f79fda3db25cdee70da8a0bcde0a1c6cdabec8d1b3c9dde2";
const POLLING_INTERVAL_MS = 5000; // 5 segundos
const MAX_POLLING_ATTEMPTS = 120; // Aproximadamente 10 minutos (5s * 120)

// Headers CORS para permitir requisições de origens diferentes
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cria uma resposta HTTP com status de erro e payload JSON.
 * @param message Mensagem de erro.
 * @param status Código de status HTTP.
 * @param customHeaders Headers adicionais.
 * @returns Um objeto Response do Deno.
 */
function errorResponse(
  message: string,
  status: number,
  customHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...customHeaders },
    },
  );
}

/**
 * Cria uma resposta HTTP de sucesso com payload JSON.
 * @param data Dados a serem enviados no corpo da resposta.
 * @param status Código de status HTTP.
 * @param customHeaders Headers adicionais.
 * @returns Um objeto Response do Deno.
 */
function successResponse(
  data: Record<string, unknown>,
  status: number = 200,
  customHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...customHeaders },
    },
  );
}

// Servidor Deno HTTP
serve(async (req) => {
  // Lida com requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Extrai o prompt do corpo da requisição JSON
    const { prompt } = await req.json() as { prompt?: string };

    // Valida a presença do prompt
    if (!prompt) {
      return errorResponse("O campo 'prompt' é obrigatório.", 400);
    }

    // Obtém o token da API Replicate das variáveis de ambiente
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return errorResponse(
        "A variável de ambiente 'REPLICATE_API_TOKEN' não está configurada. Por favor, adicione sua chave API do Replicate.",
        500, // Alterado para 500, pois é um erro de configuração do servidor
        { requiresSetup: "true" } // Atributo extra para o frontend identificar a necessidade de setup
      );
    }

    // 1. Inicia a geração de vídeo no Replicate
    console.log(`Iniciando geração de vídeo com prompt: "${prompt}"`);
    const createPredictionResponse = await fetch(`${REPLICATE_API_BASE_URL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: LUMA_RAY_MODEL_VERSION,
        input: {
          prompt: prompt,
          aspect_ratio: "16:9",
          loop: false,
        },
      }),
    });

    if (!createPredictionResponse.ok) {
      const errorDetail = await createPredictionResponse.text();
      console.error(
        "Erro ao iniciar predição no Replicate:",
        createPredictionResponse.status,
        errorDetail,
      );
      return errorResponse(
        `Erro ao iniciar a geração do vídeo: ${errorDetail}`,
        createPredictionResponse.status || 500,
      );
    }

    let prediction = await createPredictionResponse.json();
    console.log(`Predição iniciada, ID: ${prediction.id}, Status: ${prediction.status}`);

    // 2. Poll para verificar o status da predição até que seja concluída (sucedida ou falha)
    let attempts = 0;
    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      attempts < MAX_POLLING_ATTEMPTS
    ) {
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS)); // Espera X segundos

      const statusResponse = await fetch(`${REPLICATE_API_BASE_URL}/predictions/${prediction.id}`, {
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(
          `Erro ao verificar o status da predição: ${statusResponse.status} ${
            await statusResponse.text()
          }`,
        );
      }

      prediction = await statusResponse.json();
      console.log(`Polling - Predição ID: ${prediction.id}, Status: ${prediction.status}`);
      attempts++;
    }

    // 3. Verifica o resultado final da predição
    if (prediction.status === "failed") {
      console.error(
        `Geração de vídeo falhou para o prompt "${prompt}". Erro: ${prediction.error}`,
      );
      return errorResponse(
        prediction.error || "A geração do vídeo falhou por um erro desconhecido.",
        500,
      );
    }

    if (prediction.status !== "succeeded") {
      console.warn(
        `Geração de vídeo não concluída no tempo limite para o prompt: "${prompt}". Status final: ${prediction.status}`,
      );
      return errorResponse(
        "A geração do vídeo excedeu o tempo limite. Tente novamente mais tarde.",
        504, // Gateway Timeout
      );
    }

    const videoUrl = prediction.output;

    // 4. Retorna a URL do vídeo gerado
    const responsePayload = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Vídeo gerado com sucesso! Confira o resultado abaixo:",
      type: "video",
      mediaUrl: videoUrl,
      timestamp: new Date().toISOString(),
    };

    console.log(`Vídeo gerado com sucesso para o prompt: "${prompt}". URL: ${videoUrl}`);
    return successResponse(responsePayload);
  } catch (error) {
    // Lida com erros inesperados
    console.error("Kojak Motion - Erro inesperado:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Ocorreu um erro interno desconhecido.",
      500,
    );
  }
});