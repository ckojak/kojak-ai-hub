// Helpers compartilhados para chamar a API do Google Gemini diretamente.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ChatMsg = { role: string; content: any };

/** Converte mensagens estilo OpenAI para o formato `contents` do Gemini. */
export function toGeminiContents(messages: ChatMsg[]) {
  const contents: any[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];

    if (typeof m.content === "string") {
      if (m.content.trim()) parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block?.type === "text" && block.text) {
          parts.push({ text: block.text });
        } else if (block?.type === "image_url" && block.image_url?.url) {
          const part = dataUrlToInlineData(block.image_url.url);
          if (part) parts.push(part);
        }
      }
    }

    if (parts.length) contents.push({ role, parts });
  }
  return contents;
}

/** Aceita data URL base64 (ou URL http, que é baixada pelo caller). */
export function dataUrlToInlineData(url: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url || "");
  if (!match) return null;
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

/** Baixa uma URL http(s) e converte para inlineData. */
export async function urlToInlineData(url: string) {
  const inline = dataUrlToInlineData(url);
  if (inline) return inline;
  if (!/^https?:\/\//.test(url)) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return { inlineData: { mimeType, data: btoa(binary) } };
}

export function missingKeyResponse() {
  return new Response(
    JSON.stringify({
      error:
        "GEMINI_API_KEY não configurada. Adicione o secret nas configurações do projeto para ativar a IA.",
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Traduz erros da API do Gemini para o formato que o app já espera. */
export async function geminiErrorResponse(response: Response, prefix: string) {
  const errText = await response.text().catch(() => "");
  console.error(prefix, response.status, errText);

  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento e tente novamente." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY inválida ou sem permissão para este modelo." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ error: `Erro na IA: ${response.status} ${errText.slice(0, 300)}` }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Converte o SSE do Gemini (`streamGenerateContent?alt=sse`) em SSE no
 * formato OpenAI chat.completions.chunk, que é o que o frontend consome.
 */
export function geminiStreamToOpenAISSE(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const id = crypto.randomUUID();
  let buffer = "";

  const emit = (text: string) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      })}\n\n`,
    );

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const parts = json?.candidates?.[0]?.content?.parts ?? [];
              for (const part of parts) {
                if (typeof part?.text === "string" && part.text) {
                  controller.enqueue(emit(part.text));
                }
              }
            } catch {
              // chunk parcial/inválido: ignora
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Erro no stream Gemini:", err);
        controller.error(err);
      }
    },
  });
}
lovable-sync-1786317085

const LANGUAGE_NAMES: Record<string, string> = {
  pt: "português do Brasil",
  en: "English",
  es: "español",
  de: "Deutsch",
  zh: "中文（简体）",
};

/** Gera a instrução de idioma pro system prompt, com base no idioma escolhido no app. */
export function languageInstruction(language?: string): string {
  const lang = (language || "pt").toLowerCase();
  if (lang === "pt") return "";
  const name = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.pt;
  return `\n\n## IDIOMA OBRIGATÓRIO\nResponda SEMPRE em ${name}, independente do idioma em que o usuário escreveu, a menos que ele peça explicitamente outro idioma.`;
}
main
