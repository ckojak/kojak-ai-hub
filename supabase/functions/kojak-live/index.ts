import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  callGroq,
  groqErrorResponse,
  jsonError,
  languageInstruction,
  missingKeyResponse,
  resolveTier,
  STT_MODEL,
  GROQ_BASE,
} from "../_shared/groq.ts";

// ---------------------------------------------------------------------------
// Conversa normal (Kojak Live)
// ---------------------------------------------------------------------------
const LIVE_PROMPT = `Você é a Kojak IA em modo Live — uma conversa por voz, em tempo real.

## REGRAS DE VOZ (obrigatórias)
- **Fale como gente fala.** Frases curtas, tom natural, sem formalidade de documento.
- **Máximo 2 ou 3 frases por resposta.** Isso é uma conversa, não uma palestra.
- **Zero formatação.** Sem markdown, sem bullets, sem asteriscos, sem blocos de código, sem emojis — tudo isso soa horrível quando falado.
- **Números e siglas por extenso** quando ajudar a pronúncia.
- **Se a pergunta for complexa**, dê a resposta essencial e ofereça detalhar: "quer que eu aprofunde?".
- **Se o áudio veio confuso ou vazio**, peça para repetir em uma frase curta.
- **Nunca invente.** Se não souber, diga que não sabe.

## CURSOS DE IDIOMAS
Você tem um curso de idiomas por voz, que o sistema ativa sozinho quando a pessoa pede, por exemplo: "vamos começar o curso de inglês". Idiomas disponíveis: inglês, espanhol, francês, alemão, italiano, japonês, chinês, coreano, russo, árabe, hindi, holandês, turco, polonês, grego, hebraico e sueco.
- Se a pessoa perguntar sobre aprender idiomas, explique em uma frase que basta dizer "vamos começar o curso de" e o nome do idioma.
- Se pedirem um idioma fora da lista, diga que ainda não tem esse idioma.

## LIMITE RÍGIDO
Fora do curso de idiomas, nunca crie, estruture ou desenvolva cursos, módulos de ensino, aulas ou currículos.`;

const LANG_CODES: Record<string, string> = {
  pt: "pt", en: "en", es: "es", de: "de", zh: "zh",
};

// ---------------------------------------------------------------------------
// Curso de idiomas
// ---------------------------------------------------------------------------
interface Course {
  lang: string;    // nome do idioma em português, ex.: "inglês"
  code: string;    // código ISO para o Whisper, ex.: "en"
  correct: number; // total de acertos até agora
  level: number;   // 1 a 10
  target: string;  // frase que o aluno precisa repetir agora
}

const COURSE_LANGS: Record<string, { name: string; code: string }> = {
  ingles: { name: "inglês", code: "en" },
  espanhol: { name: "espanhol", code: "es" },
  frances: { name: "francês", code: "fr" },
  alemao: { name: "alemão", code: "de" },
  italiano: { name: "italiano", code: "it" },
  japones: { name: "japonês", code: "ja" },
  chines: { name: "chinês", code: "zh" },
  mandarim: { name: "chinês", code: "zh" },
  coreano: { name: "coreano", code: "ko" },
  russo: { name: "russo", code: "ru" },
  arabe: { name: "árabe", code: "ar" },
  hindi: { name: "hindi", code: "hi" },
  holandes: { name: "holandês", code: "nl" },
  turco: { name: "turco", code: "tr" },
  polones: { name: "polonês", code: "pl" },
  grego: { name: "grego", code: "el" },
  hebraico: { name: "hebraico", code: "he" },
  sueco: { name: "sueco", code: "sv" },
};

const EXPLAIN_NAMES: Record<string, string> = {
  pt: "português", en: "inglês", es: "espanhol", de: "alemão", zh: "chinês",
};

const LEVELS =
  "1 palavras soltas e cumprimentos; 2 apresentação e frases de 2 a 3 palavras; " +
  "3 frases curtas com o verbo ser/estar; 4 pessoas, família, números e cores; " +
  "5 perguntas do dia a dia; 6 pedidos e situações práticas (restaurante, mercado, direções); " +
  "7 passado; 8 futuro e planos; 9 mini diálogos e opiniões; " +
  "10 frases longas, expressões idiomáticas e conversa livre";

const levelFor = (correct: number) => Math.min(10, 1 + Math.floor(correct / 3));

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const LANG_ALT = Object.keys(COURSE_LANGS).join("|");
const KEYWORDS = "curso|aula|aulas|aprender|estudar|ensin\\w*|pratic\\w*";
const START_RE_1 = new RegExp(`\\b(?:${KEYWORDS})\\b[^.?!]{0,40}?\\b(${LANG_ALT})\\b`);
const START_RE_2 = new RegExp(`\\b(${LANG_ALT})\\b[^.?!]{0,40}?\\b(?:${KEYWORDS})\\b`);
const STOP_RE =
  /\b(parar|parei|encerrar|encerra|sair|terminar|acabar|finalizar|chega de)\b[^.?!]{0,20}\b(curso|aula)\b|\bsair do curso\b/;

function detectCourseStart(transcript: string): { name: string; code: string } | null {
  const t = norm(transcript);
  const m = t.match(START_RE_1) || t.match(START_RE_2);
  if (!m) return null;
  return COURSE_LANGS[m[1]] || null;
}

function parseCourse(v: unknown): Course | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lang = String(o.lang || "").slice(0, 40);
  const code = String(o.code || "").slice(0, 5);
  if (!lang || !code) return null;
  const correct = Math.max(0, Math.min(500, Number(o.correct) || 0));
  return {
    lang,
    code,
    correct,
    level: levelFor(correct),
    target: String(o.target || "").slice(0, 300),
  };
}

function coursePrompt(opts: {
  lang: string;
  explain: string;
  level: number;
  nextLevel: number;
  target: string;
}): string {
  const { lang, explain, level, nextLevel, target } = opts;

  const base = `Você é a Kojak IA, professora de ${lang} por voz. A pessoa está aprendendo ${lang} do básico ao avançado, num curso de verdade, passo a passo. Você explica em ${explain}.

## COMO VOCÊ ENSINA
- Você sempre conduz a aula: ensina UMA frase por vez.
- Ao ensinar: diga em uma frase curta o que a frase significa, depois diga "Repita:" (no idioma da explicação) e, no final, a frase em ${lang}. A frase em ${lang} aparece uma única vez, no final do texto.
- Currículo (o nível sobe sozinho): ${LEVELS}.
- Nunca repita uma frase que já foi ensinada nesta conversa.
- Fale como gente fala: no máximo 3 frases curtas, sem markdown, sem bullets, sem emojis.
- Para idiomas com alfabeto próprio, escreva a frase em ${lang} no alfabeto nativo.`;

  if (!target) {
    return `${base}

## AGORA
O curso está começando (ou recomeçando). Apresente-se em uma frase curta, diga em uma frase que você fala, a pessoa repete, e você só avança quando ela acertar. Depois ensine a PRIMEIRA frase, do nível ${nextLevel}.

Responda APENAS com JSON, sem markdown e sem texto fora dele:
{"say": "texto que será falado em voz alta", "next": "a frase em ${lang} que a pessoa deve repetir"}`;
  }

  return `${base}

## AVALIAÇÃO
Frase que a pessoa deveria repetir: "${target}". Nível atual: ${level}.
Você recebe a transcrição automática do que a pessoa disse, transcrita como se fosse ${lang}.
- A resposta está CORRETA se as palavras essenciais batem com a frase (ignore maiúsculas, pontuação e acentos gráficos).
- Está INCORRETA se faltou palavra, se trocou palavra, se disse outra frase, ou se a transcrição não faz sentido (pronúncia muito diferente).

Se CORRETA: elogie em poucas palavras e ensine a PRÓXIMA frase, nova, do nível ${nextLevel}. Se o nível subiu, avise em uma frase curta.
Se INCORRETA: diga em uma frase o que faltou ou errou (cite a palavra), diga "Escute de novo:" (no idioma da explicação), fale a frase correta em ${lang} e termine com "Agora você." (no idioma da explicação). Não avance de etapa.
Se a pessoa fizer uma pergunta ou pedir ajuda em ${explain}: responda curto e peça para repetir a mesma frase.
Se a pessoa pedir para repetir ou falar mais devagar: repita a mesma frase.

Responda APENAS com JSON, sem markdown e sem texto fora dele:
{"correct": true ou false, "say": "texto que será falado em voz alta", "next": "a frase em ${lang} que a pessoa deve repetir a seguir"}`;
}

function extractJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { audio, mimeType, text, history, context, language, tier, transcribeOnly } = body || {};

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) return missingKeyResponse();

    const uiLang = String(language || "pt").slice(0, 2);
    const lang = LANG_CODES[uiLang] || "pt";
    const explain = EXPLAIN_NAMES[uiLang] || "português";

    const activeCourse = parseCourse(body?.course);

    // 1) Transcrição (se veio áudio)
    let transcript = typeof text === "string" ? text.trim() : "";

    if (!transcript && audio) {
      const bin = Uint8Array.from(atob(String(audio)), (c) => c.charCodeAt(0));
      const type = String(mimeType || "audio/webm");
      const extMap: Record<string, string> = {
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp3": "mp3",
        "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/wav": "wav",
        "audio/x-wav": "wav", "audio/wave": "wav", "audio/flac": "flac", "audio/aac": "aac",
      };
      const ext = extMap[type.split(";")[0].trim()] || "webm";
      const form = new FormData();
      form.append("file", new Blob([bin], { type }), `audio.${ext}`);
      form.append("model", STT_MODEL);
      // Durante o curso a transcrição é forçada no idioma estudado.
      form.append("language", activeCourse ? activeCourse.code : lang);
      form.append("temperature", "0");
      form.append("response_format", "json");

      const sttRes = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
      });

      if (!sttRes.ok) return await groqErrorResponse(sttRes, "Kojak Live STT");

      const sttData = await sttRes.json();
      transcript = String(sttData.text || "").trim();
    }

    // Modo "só transcrever" — usado pelo anexo de áudio no chat de texto.
    if (transcribeOnly) {
      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtra ruído. No curso, só descarta transcrição vazia (o aluno pode
    // repetir "thank you", "obrigado" etc. e isso não pode ser tratado como ruído).
    const isEmpty = /^[\s.,!?…-]*$/.test(transcript);
    const noise = activeCourse
      ? isEmpty
      : isEmpty ||
        transcript.length < 2 ||
        /^(obrigado|thank you|thanks|legendas|subtitles|amara\.org|tchau)[.!\s]*$/i.test(transcript);

    if (noise) {
      return new Response(JSON.stringify({ transcript: "", reply: "", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolved = resolveTier(tier);
    const reply200 = (obj: Record<string, unknown>) =>
      new Response(JSON.stringify(obj), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    /** Chama o modelo. Retorna o texto, ou uma Response de erro. */
    const runChat = async (
      system: string,
      userText: string,
      useHistory: boolean,
    ): Promise<{ text: string } | { error: Response }> => {
      const messages: any[] = [{ role: "system", content: system }];
      if (useHistory && Array.isArray(history)) {
        for (const m of history.slice(-12)) {
          if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()) {
            messages.push({ role: m.role, content: m.content.slice(0, 2000) });
          }
        }
      }
      messages.push({ role: "user", content: userText });

      const chatRes = await callGroq({ apiKey: GROQ_API_KEY, tier: resolved, messages, stream: false });
      if (!chatRes.ok) return { error: await groqErrorResponse(chatRes, "Kojak Live Chat") };

      const chatData = await chatRes.json();
      return { text: String(chatData.choices?.[0]?.message?.content || "").trim() };
    };

    const personalContext =
      context && typeof context === "string" && context.trim()
        ? `\n\n## CONTEXTO PESSOAL DO USUÁRIO\n${context.trim()}`
        : "";

    // 2) Curso de idiomas ---------------------------------------------------
    const wantsStop = !!activeCourse && STOP_RE.test(norm(transcript));
    const startedLang = !activeCourse ? detectCourseStart(transcript) : null;

    // 2a) Encerrar curso
    if (wantsStop) {
      const system =
        LIVE_PROMPT +
        personalContext +
        `\n\n## AGORA\nA pessoa encerrou o curso de ${activeCourse!.lang}. Confirme em uma frase curta e diga que ela pode retomar quando quiser, pedindo o curso de novo.` +
        languageInstruction(language);
      const out = await runChat(system, transcript, true);
      if ("error" in out) return out.error;
      return reply200({ transcript, reply: out.text, course: null });
    }

    // 2b) Começar curso (pedido novo, ou curso ativo ainda sem frase)
    if (startedLang || (activeCourse && !activeCourse.target)) {
      const base: Course = activeCourse
        ? activeCourse
        : { lang: startedLang!.name, code: startedLang!.code, correct: 0, level: 1, target: "" };

      const system = coursePrompt({
        lang: base.lang,
        explain,
        level: base.level,
        nextLevel: base.level,
        target: "",
      });
      const out = await runChat(system, transcript, false);
      if ("error" in out) return out.error;

      const j = extractJson(out.text);
      const say = String(j?.say || "").trim() || out.text;
      const next = String(j?.next || "").trim();
      return reply200({
        transcript,
        reply: say,
        course: { ...base, target: next },
      });
    }

    // 2c) Avaliar a resposta do aluno e avançar (ou repetir)
    if (activeCourse) {
      const nextLevel = levelFor(activeCourse.correct + 1);
      const system = coursePrompt({
        lang: activeCourse.lang,
        explain,
        level: activeCourse.level,
        nextLevel,
        target: activeCourse.target,
      });
      const out = await runChat(system, transcript, true);
      if ("error" in out) return out.error;

      const j = extractJson(out.text);
      const say = String(j?.say || "").trim() || out.text;
      const isCorrect = j?.correct === true;
      const proposed = String(j?.next || "").trim();

      // Regra do servidor: só avança se acertou. Se errou, a frase é sempre a mesma.
      const newCorrect = activeCourse.correct + (isCorrect ? 1 : 0);
      const newTarget = isCorrect && proposed ? proposed : activeCourse.target;

      return reply200({
        transcript,
        reply: say,
        correct: isCorrect,
        course: {
          ...activeCourse,
          correct: newCorrect,
          level: levelFor(newCorrect),
          target: newTarget,
        },
      });
    }

    // 3) Conversa normal ------------------------------------------------------
    const system = LIVE_PROMPT + personalContext + languageInstruction(language);
    const out = await runChat(system, transcript, true);
    if ("error" in out) return out.error;

    return reply200({ transcript, reply: out.text });
  } catch (error) {
    console.error("Kojak Live error:", error);
    return jsonError(error instanceof Error ? error.message : "Erro desconhecido no Kojak Live");
  }
});
