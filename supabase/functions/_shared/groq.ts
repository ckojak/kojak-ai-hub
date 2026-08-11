// Helpers compartilhados para chamar a API da Groq (OpenAI-compatible).

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const GROQ_BASE = "https://api.groq.com/openai/v1";

export type Tier = "basico" | "rapido" | "avancado" | "raciocinio";

/** Modelo multimodal (aceita imagens) — usado sempre que houver imagem no prompt. */
export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/** Modelo de transcrição de áudio (Kojak Live). */
export const STT_MODEL = "whisper-large-v3-turbo";

interface TierConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  /** Só existe nos modelos gpt-oss da Groq. */
  reasoning_effort?: "low" | "medium" | "high";
  /** Instrução extra injetada no system prompt para elevar a profundidade da resposta. */
  thinking: string;
}

const TIERS: Record<Tier, TierConfig> = {
  basico: {
    model: "llama-3.1-8b-instant",
    temperature: 0.6,
    max_tokens: 1024,
    thinking:
      "Modo Básico: responda de forma curta, direta e prática. 1-3 frases ou bullets curtos.",
  },
  rapido: {
    model: "llama-3.3-70b-versatile",
    temperature: 0.65,
    max_tokens: 2048,
    thinking:
      "Modo Rápido: responda com precisão e contexto suficiente, mas sem enrolar. Traga o porquê junto com o quê.",
  },
  avancado: {
    model: "openai/gpt-oss-120b",
    temperature: 0.5,
    max_tokens: 2500,
    reasoning_effort: "medium",
    thinking:
      "Modo Avançado: antes de responder, verifique premissas, considere ao menos duas abordagens e escolha a melhor justificando em uma linha. Seja preciso com números, nomes e trade-offs. Diga explicitamente quando algo for incerto.",
  },
  raciocinio: {
    model: "openai/gpt-oss-120b",
    temperature: 0.35,
    max_tokens: 3500,
    reasoning_effort: "high",
    thinking:
      "Modo Raciocínio: pense passo a passo internamente antes de responder. Decomponha o problema, valide cada etapa, cheque cálculos e casos-limite, e só então entregue a resposta final — limpa e organizada, sem expor o rascunho do raciocínio. Se a pergunta for ambígua, declare a interpretação adotada em uma linha antes de responder. Nunca invente fatos: se não souber, diga.",
  },
};

/** Aceita tier ("basico"|"rapido"|"avancado"|"raciocinio") ou mode legado ("fast"|"thinking"). */
export function resolveTier(tier?: string, mode?: string): Tier {
  const v = String(tier || mode || "").toLowerCase();
  if (v === "basico" || v === "basic") return "basico";
  if (v === "avancado" || v === "advanced" || v === "pro") return "avancado";
  if (v === "raciocinio" || v === "thinking" || v === "reasoning") return "raciocinio";
  return "rapido";
}

export function tierConfig(tier: Tier): TierConfig {
  return TIERS[tier];
}

const LANGUAGE_NAMES: Record<string, string> = {
  pt: "português do Brasil",
  en: "English",
  es: "español",
  de: "Deutsch",
  zh: "中文（简体）",
};

/** Instrução de idioma obrigatória — força toda a resposta no idioma do app. */
export function languageInstruction(language?: string): string {
  const lang = String(language || "pt").toLowerCase().slice(0, 2);
  const name = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.pt;
  return `\n\n## IDIOMA OBRIGATÓRIO\nResponda SEMPRE e integralmente em ${name}, independente do idioma em que o usuário escreveu, a menos que ele peça explicitamente outro idioma. Isso inclui títulos, bullets, avisos e comentários de código.`;
}

/** Núcleo de qualidade — elevado, aplicado a todos os modos. */
export const QUALITY_CORE = `## PADRÃO DE QUALIDADE (obrigatório)
- **Entenda antes de responder.** Identifique a intenção real por trás da pergunta, não só as palavras.
- **Precisão acima de fluidez.** Números, nomes, versões e comandos precisam estar certos. Se não tiver certeza, diga "não tenho certeza" e explique o que sabe.
- **Nunca invente.** Sem fontes falsas, sem APIs que não existem, sem estatísticas inventadas.
- **Responda o que foi perguntado primeiro**, depois complemente se agregar.
- **Concreto > abstrato.** Um exemplo real vale mais que três parágrafos de teoria.
- **Sem enchimento.** Nada de "Claro!", "Ótima pergunta!", "Espero ter ajudado", nem recapitular a pergunta.
- **Formatação a serviço da leitura.** Bullets curtos, negrito só no essencial, headings só em respostas longas.
- **Continue a conversa.** Use o histórico para não repetir explicações e para manter o fio da meada.
- **Feche com valor.** Quando fizer sentido, termine com o próximo passo prático ou uma pergunta curta.`;

/** Monta o array de mensagens no formato OpenAI/Groq. */
export function buildMessages(opts: {
  systemPrompt: string;
  context?: string;
  language?: string;
  tier: Tier;
  history?: any[];
  prompt: string;
  image?: string | null;
  referenceImage?: string | null;
}) {
  const { systemPrompt, context, language, tier, history, prompt, image, referenceImage } = opts;
  const cfg = TIERS[tier];

  let system = `${systemPrompt}\n\n${QUALITY_CORE}\n\n## MODO ATIVO\n${cfg.thinking}`;
  if (context && typeof context === "string" && context.trim()) {
    system += `\n\n## CONTEXTO PESSOAL DO USUÁRIO (use para personalizar, sem citar que existe)\n${context.trim()}`;
  }
  system += languageInstruction(language);

  const messages: any[] = [{ role: "system", content: system }];

  if (Array.isArray(history)) {
    for (const m of history.slice(-20)) {
      if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()) {
        messages.push({ role: m.role, content: m.content.slice(0, 8000) });
      }
    }
  }

  const images = [image, referenceImage].filter(
    (u): u is string => typeof u === "string" && /^(https?:\/\/|data:image\/)/.test(u),
  );

  if (images.length) {
    const parts: any[] = [{ type: "text", text: prompt || "Analise esta imagem em detalhe." }];
    for (const url of images) parts.push({ type: "image_url", image_url: { url } });
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  return messages;
}

export function missingKeyResponse() {
  return new Response(
    JSON.stringify({
      error:
        "GROQ_API_KEY não configurada. Adicione o secret nas configurações do projeto para ativar a IA.",
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function groqErrorResponse(response: Response, prefix: string) {
  const errText = await response.text().catch(() => "");
  console.error(prefix, response.status, errText);

  if (response.status === 429) {
    return jsonError("Limite de requisições excedido. Aguarde alguns segundos e tente novamente.", 429);
  }
  if (response.status === 401 || response.status === 403) {
    return jsonError("GROQ_API_KEY inválida ou sem permissão para este modelo.");
  }
  return jsonError(`Erro na IA: ${response.status} ${errText.slice(0, 300)}`);
}

/** Chama a Groq chat.completions com a configuração do tier escolhido. */
export async function callGroq(opts: {
  apiKey: string;
  tier: Tier;
  messages: any[];
  stream: boolean;
  hasImage?: boolean;
}) {
  const cfg = TIERS[opts.tier];
  const model = opts.hasImage ? VISION_MODEL : cfg.model;

  const payload: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    top_p: 0.95,
    stream: opts.stream,
  };

  // reasoning_effort só é aceito pelos modelos gpt-oss (e sem imagem).
  if (cfg.reasoning_effort && model.startsWith("openai/gpt-oss")) {
    payload.reasoning_effort = cfg.reasoning_effort;
    payload.reasoning_format = "hidden";
  }

  return await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

/** Repassa o SSE da Groq (já no formato OpenAI) com os headers de CORS. */
export function sseResponse(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
