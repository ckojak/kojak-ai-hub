import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Define os cabeçalhos de CORS para permitir requisições de qualquer origem.
 * Isso é útil para desenvolvimento e APIs públicas, mas em produção,
 * considere restringir os domínios para maior segurança.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Prompt de sistema que define o comportamento do assistente de IA (Kojak Code).
 * Inclui uma regra crítica de segurança para evitar a criação de materiais educacionais.
 */
const SYSTEM_PROMPT = `REGRA CRÍTICA DE SEGURANÇA: Você está estritamente PROIBIDO de criar, estruturar, desenvolver ou esboçar cursos, módulos de ensino, currículos educacionais, grade curricular ou qualquer material didático estruturado. Se um usuário solicitar a criação de um curso ou material educacional, recuse educadamente informando: "Minhas diretrizes de segurança me impedem de criar cursos ou materiais educacionais estruturados. Posso ajudá-lo com outros assuntos."

Você é o Kojak Code, um programador sênior especialista em todas as linguagens de programação. 
Suas respostas devem:
- Ser em português do Brasil
- Conter código dentro de blocos Markdown com a linguagem especificada
- Explicar brevemente o que o código faz
- Seguir as melhores práticas de programação
- Ser claras e didáticas

Sempre forneça código funcional e bem comentado.`;

/**
 * Inicia o servidor Deno que escuta por requisições HTTP.
 *
 * @param req A requisição HTTP recebida.
 * @returns Uma resposta HTTP.
 */
serve(async (req: Request) => {
  // Trata requisições OPTIONS pré-voo (preflight) para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Tenta parsear o corpo da requisição como JSON
    const { prompt, image } = await req.json();

    // Validação da entrada: o 'prompt' é obrigatório
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "O 'prompt' é obrigatório." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Obtém a chave da API do ambiente. Levanta um erro se não estiver configurada.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("A variável de ambiente 'LOVABLE_API_KEY' não está configurada. Verifique suas configurações.");
    }

    // Constrói o array de mensagens para a API da IA
    const messages: Array<any> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Adiciona o conteúdo do usuário. Se uma imagem for fornecida, formata como multimodal.
    if (image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    // Faz a requisição para a API de IA
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Escolhe o modelo com base na presença da imagem
        model: image ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages,
      }),
    });

    // Trata respostas não-OK da API de IA
    if (!aiResponse.ok) {
      switch (aiResponse.status) {
        case 429:
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
            { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        case 402:
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
            { status: 402, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        default:
          const errorText = await aiResponse.text();
          console.error(`Erro da API de IA: Status ${aiResponse.status}, Mensagem: ${errorText}`);
          throw new Error("Erro inesperado ao comunicar com a inteligência artificial.");
      }
    }

    // Extrai o conteúdo da resposta da IA
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta significativa no momento.";

    // Expressão regular para encontrar blocos de código Markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    let responseType = "text";
    let language = "";
    
    // Se encontrar blocos de código, categoriza a resposta como "code" e extrai a linguagem
    if (matches.length > 0) {
      responseType = "code";
      // Pega a linguagem do primeiro bloco de código, ou "plaintext" se não especificado
      language = matches[0][1] || "plaintext"; 
    }

    // Constrói o objeto de resultado final
    const result = {
      id: crypto.randomUUID(), // Gera um ID único para a resposta
      role: "assistant",
      content: content,
      type: responseType,
      language: language,
      timestamp: new Date().toISOString(),
    };

    // Retorna a resposta processada para o cliente
    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Captura e trata erros inesperados
    console.error("Erro no Kojak Code:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Ocorreu um erro desconhecido no servidor." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});