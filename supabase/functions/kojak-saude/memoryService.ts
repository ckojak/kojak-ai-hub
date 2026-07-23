import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function generateEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }], role: "user" },
    }),
  });
  if (!res.ok) throw new Error("Embedding failed: " + res.status);
  const data = await res.json();
  return data.embedding?.values ?? [];
}

export async function extractMemories(
  messages: { role: string; content: string }[],
  userId: string,
  chatId: string
): Promise<number> {
  const { data: alreadyProcessed } = await supabase
    .from("memory_processing_log")
    .select("id")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (alreadyProcessed) return 0;

  const conversationText = messages
    .slice(-15)
    .map((m) => (m.role === "user" ? "USUÁRIO" : "KOJAK") + ": " + m.content)
    .join("\n\n");

  const extractionPrompt = "Analise a conversa abaixo e extraia INFORMAÇÕES DURÁVEIS sobre o usuário que valeria a pena lembrar em conversas futuras.\n\nRegras:\n- Só extraia coisas PERMANENTES (preferências, fatos pessoais, decisões, contexto recorrente)\n- NÃO extraia perguntas pontuais ou tópicos da conversa atual\n- Seja específico (ex: 'Usuário trabalha com engenharia fotovoltaica' em vez de 'Usuário trabalha')\n- Se não houver nada digno de memorizar, retorne um array vazio []\n\nFormato de saída (JSON válido, sem markdown):\n[{\"content\":\"texto da memória\",\"category\":\"preference|fact|decision|personal|general\",\"importance\":1-10}]\n\nCONVERSA:\n" + conversationText + "\n\nResponda apenas com o JSON:";

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extractionPrompt }], role: "user" }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );
  if (!res.ok) {
    console.error("[memory] extract failed:", res.status);
    await logProcessing(chatId, 0);
    return 0;
  }
  const data = await res.json();
  const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  const cleanJson = rawOutput
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let memories: Array<{ content: string; category: string; importance: number }> = [];
  try {
    memories = JSON.parse(cleanJson);
  } catch (e) {
    console.error("[memory] parse error:", e);
    await logProcessing(chatId, 0);
    return 0;
  }

  if (!Array.isArray(memories) || memories.length === 0) {
    await logProcessing(chatId, 0);
    return 0;
  }

  const rows = await Promise.all(
    memories.map(async (mem) => {
      const embedding = await generateEmbedding(mem.content);
      return {
        user_id: userId,
        content: mem.content,
        category: mem.category || "general",
        importance: mem.importance || 5,
        embedding,
        source_chat_id: chatId,
      };
    })
  );

  const { error } = await supabase.from("user_memories").insert(rows);
  if (error) {
    console.error("[memory] insert error:", error);
    return 0;
  }

  await logProcessing(chatId, memories.length);
  console.log("[memory] " + memories.length + " memórias extraídas para " + userId);
  return memories.length;
}

export async function retrieveRelevantMemories(
  userMessage: string,
  userId: string,
  limit = 5
): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(userMessage);
    const { data: memories, error } = await supabase.rpc("match_memories", {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: limit,
      match_threshold: 0.3,
    });
    if (error || !memories || memories.length === 0) return "";
    const formatted = memories
      .map((m: any) => "[" + m.category.toUpperCase() + "|imp:" + m.importance + "] " + m.content)
      .join("\n");
    return "\n\n## MEMÓRIAS RELEVANTES SOBRE O USUÁRIO\n" + formatted + "\n(Use para personalizar a resposta. Não cite que está lembrando.)\n";
  } catch (e) {
    console.error("[memory] retrieve error:", e);
    return "";
  }
}

async function logProcessing(chatId: string, count: number): Promise<void> {
  await supabase.from("memory_processing_log").insert({
    chat_id: chatId,
    memories_extracted: count,
  });
}