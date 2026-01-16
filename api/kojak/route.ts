import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const { prompt, modo } = await req.json();
    
    // 1. Configuração do Kojak Code (Gemini)
    if (modo === "code") {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      return new Response(JSON.stringify({
        content: text,
        type: "code",
        language: "typescript",
        timestamp: new Date().toISOString()
      }), { status: 200 });
    }

    // 2. Configuração do Kojak Motion (Vídeo via Replicate)
    if (modo === "motion") {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      
      // Modelo Luma Ray para alta qualidade
      const output = await replicate.run(
        "luma/ray",
        { input: { prompt: prompt } }
      );

      return new Response(JSON.stringify({
        content: "Vídeo gerado com sucesso!",
        type: "video",
        mediaUrl: output,
        timestamp: new Date().toISOString()
      }), { status: 200 });
    }

    // 3. Configuração do Kojak Vision (Imagem)
    if (modo === "vision") {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        { input: { prompt: prompt } }
      );

      return new Response(JSON.stringify({
        content: "Imagem gerada com sucesso!",
        type: "image",
        mediaUrl: (output as string[])[0],
        timestamp: new Date().toISOString()
      }), { status: 200 });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
