import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, image, reference_image } = await req.json();

    // Validação básica
    if (!prompt && !image && !reference_image) {
      return new Response(
        JSON.stringify({ error: "É necessário fornecer um prompt ou pelo menos uma imagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("Erro de configuração: LOVABLE_API_KEY não encontrada.");
    }

    // --- ENGENHARIA DE PROMPT AVANÇADA ---
    let messageContent: any = [];
    let systemInstruction = "";

    if (image && reference_image) {
        // CENÁRIO 1: DUAS IMAGENS (Face Swap / Edição Complexa)
        // Definimos um papel de especialista e regras claras para a IA.
        systemInstruction = `ATENÇÃO: Você é um especialista em edição de imagem e fusão realista (Face Swap/Object Replacement).
        Sua tarefa é pegar os elementos chave da IMAGEM FONTE (especialmente rostos) e integrá-los perfeitamente na IMAGEM ALVO.
        Mantenha a iluminação, sombras, tom de pele, ângulo e expressão da IMAGEM ALVO para um resultado 100% fotorrealista e imperceptível.
        Ignore o fundo da imagem fonte. O resultado final deve parecer a imagem alvo original, mas com o novo elemento integrado.`;
        
        messageContent.push({ type: "text", text: `${systemInstruction}\n\nIMAGEM ALVO (Base da composição):` });
        messageContent.push({ type: "image_url", image_url: { url: reference_image } });
        messageContent.push({ type: "text", text: "IMAGEM FONTE (Rosto/Elemento a ser extraído):" });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
            type: "text",
            text: `INSTRUÇÃO DO USUÁRIO: ${prompt || 'Realize a troca de rosto ou fusão dos elementos de forma ultra-realista.'}`
        });

    } else if (image) {
        // CENÁRIO 2: UMA IMAGEM (Geração Guiada por Imagem)
        systemInstruction = `Você é um artista digital criativo. Sua tarefa é gerar uma NOVA imagem que use a IMAGEM DE REFERÊNCIA como guia principal.
        Mantenha o estilo, a composição, as cores ou o sujeito da referência, conforme instruído pelo usuário. A nova imagem deve ser uma variação criativa e de alta qualidade.`;
        
        messageContent.push({ type: "text", text: `${systemInstruction}\n\nIMAGEM DE REFERÊNCIA:` });
        messageContent.push({ type: "image_url", image_url: { url: image } });
        messageContent.push({
            type: "text",
            text: `INSTRUÇÃO DO USUÁRIO: ${prompt}. Crie uma imagem profissional, alta resolução.`
        });

    } else {
        // CENÁRIO 3: APENAS TEXTO (Geração de Imagem Padrão)
        systemInstruction = "Você é um fotógrafo profissional e artista conceitual. Crie uma imagem deslumbrante e detalhada baseada apenas na descrição do usuário.";
        messageContent.push({
            type: "text",
            text: `${systemInstruction}\n\nINSTRUÇÃO: Crie uma imagem: ${prompt}. Fotografia profissional, ultra detalhada, iluminação cinematográfica, 8k.`
        });
    }

    console.log("Enviando para IA:", JSON.stringify(messageContent)); // Log para debug

    // Disparo para o Gateway da Lovable
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview", // Usando o modelo mais avançado disponível
        messages: [
          { 
            role: "user", 
            content: messageContent 
          }
        ],
        modalities: ["image", "text"],
        temperature: 0.2, // Baixa temperatura para seguir as instruções com mais rigor
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro no Gateway de IA:", response.status, errorText);
      if (response.status === 429) throw new Error("Muitas requisições. Tente novamente em breve.");
      if (response.status === 402) throw new Error("Créditos insuficientes na plataforma de IA.");
      throw new Error(`Erro no processamento da IA (${response.status}).`);
    }

    const data = await response.json();
    console.log("Resposta da IA:", JSON.stringify(data)); // Log para debug
    
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error("IA não retornou imagem. Resposta completa:", data);
      throw new Error("A IA processou o pedido, mas não gerou uma imagem válida.");
    }

    const result = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: data.choices?.[0]?.message?.content || "Imagem gerada com sucesso!",
      type: "image",
      mediaUrl: imageData,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro crítico na função kojak-vision:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Ocorreu um erro interno no servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
