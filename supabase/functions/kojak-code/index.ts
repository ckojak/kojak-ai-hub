import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, image } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    const systemPrompt = `REGRA CRÍTICA DE SEGURANÇA: Você está estritamente PROIBIDO de criar, estruturar, desenvolver ou esboçar cursos, módulos de ensino, currículos educacionais, grade curricular ou qualquer material didático estruturado. Se um usuário solicitar a criação de um curso ou material educacional, recuse educadamente informando: "Minhas diretrizes de segurança me impedem de criar cursos ou materiais educacionais estruturados. Posso ajudá-lo com outros assuntos."

Você é o Kojak Code, um programador sênior especialista em todas as linguagens de programação. 
Suas respostas devem:
- Ser em português do Brasil
- Conter código dentro de blocos Markdown com a linguagem especificada
- Explicar brevemente o que o código faz
- Seguir as melhores práticas de programação
- Ser claras e didáticas

Sempre forneça código funcional e bem comentado.`;

    // Build messages array
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // If image is provided, use multimodal format
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: image ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com a IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    // Extract code blocks from markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    let responseType = "text";
    let language = "";
    let responseContent = content;

    if (matches.length > 0) {
      responseType = "code";
      language = matches[0][1] || "javascript";
      responseContent = content;
    }

    const result = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: responseContent,
      type: responseType,
      language: language,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kojak Code error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
