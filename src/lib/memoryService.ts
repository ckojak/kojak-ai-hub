// memoryService.ts — Memória permanente do Kojak.AI
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Inicializa clientes
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role — bypassa RLS no backend
);

// ---------- 1. GERAR EMBEDDING ----------
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = gemini.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' }
  });
  return result.embedding.values;
}

// ---------- 2. EXTRAIR MEMÓRIAS DA CONVERSA ----------
export async function extractMemories(
  messages: { role: string; content: string }[],
  userId: string,
  chatId: string
): Promise<number> {
  // Verifica se já processou este chat
  const { data: alreadyProcessed } = await supabase
    .from('memory_processing_log')
    .select('id')
    .eq('chat_id', chatId)
    .single();

  if (alreadyProcessed) {
    return 0; // já processado, não repete
  }

  // Monta o histórico pra IA analisar
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'USUÁRIO' : 'KOJAK'}: ${m.content}`)
    .join('\n\n');

  // Prompt que extrai memórias duráveis
  const extractionPrompt = `Analise a conversa abaixo e extraia INFORMAÇÕES DURÁVEIS sobre o usuário que valeria a pena lembrar em conversas futuras.

Regras:
- Só extraia coisas PERMANENTES (preferências, fatos pessoais, decisões, contexto recorrente)
- NÃO extraia perguntas pontuais ou tópicos da conversa atual
- Seja específico (ex: "Usuário trabalha com engenharia fotovoltaica" em vez de "Usuário trabalha")
- Se não houver nada digno de memorizar, retorne um array vazio []

Formato de saída (JSON válido, sem markdown):
[
  {
    "content": "texto da memória",
    "category": "preference|fact|decision|personal|general",
    "importance": 1-10
  }
]

CONVERSA:
${conversationText}

Responda apenas com o JSON:`;

  const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(extractionPrompt);
  const rawOutput = result.response.text().trim();

  // Limpa markdown caso a IA coloque ```json
  const cleanJson = rawOutput.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  let memories: Array<{ content: string; category: string; importance: number }> = [];
  try {
    memories = JSON.parse(cleanJson);
  } catch (e) {
    console.error('[memoryService] Erro ao parsear memórias:', e);
    await logProcessing(chatId, 0);
    return 0;
  }

  if (!Array.isArray(memories) || memories.length === 0) {
    await logProcessing(chatId, 0);
    return 0;
  }

  // Gera embedding pra cada memória e insere no banco
  const memoriesToInsert = await Promise.all(
    memories.map(async (mem) => {
      const embedding = await generateEmbedding(mem.content);
      return {
        user_id: userId,
        content: mem.content,
        category: mem.category || 'general',
        importance: mem.importance || 5,
        embedding,
        source_chat_id: chatId,
      };
    })
  );

  const { error } = await supabase.from('user_memories').insert(memoriesToInsert);
  if (error) {
    console.error('[memoryService] Erro ao inserir memórias:', error);
    return 0;
  }

  await logProcessing(chatId, memories.length);
  console.log(`[memoryService] ${memories.length} memórias extraídas para o usuário ${userId}`);
  return memories.length;
}

// ---------- 3. RECUPERAR MEMÓRIAS RELEVANTES ----------
export async function retrieveRelevantMemories(
  userMessage: string,
  userId: string,
  limit: number = 5
): Promise<string[]> {
  // Gera embedding da mensagem atual
  const queryEmbedding = await generateEmbedding(userMessage);

  // Busca por similaridade (cosine) — pega as mais próximas no significado
  const { data: memories, error } = await supabase.rpc('match_memories', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: limit,
    match_threshold: 0.5  // só memórias com mais de 50% de similaridade
  });

  if (error) {
    console.error('[memoryService] Erro ao buscar memórias:', error);
    return [];
  }

  if (!memories || memories.length === 0) {
    return [];
  }

  // Formata as memórias recuperadas
  return memories.map((m: any) => 
    `[${m.category.toUpperCase()} | importância: ${m.importance}] ${m.content}`
  );
}

// ---------- 4. LOG DE PROCESSAMENTO ----------
async function logProcessing(chatId: string, count: number): Promise<void> {
  await supabase.from('memory_processing_log').insert({
    chat_id: chatId,
    memories_extracted: count,
  });
}
