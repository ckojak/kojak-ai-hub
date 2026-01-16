import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  // Resposta para o navegador confirmar a conexão (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      } 
    });
  }

  try {
    const { prompt, modo } = await req.json();
    const headers = { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*" 
    };

    // MODO CODE: Gemini
    if (modo === "code") {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      return new Response(JSON.stringify({ content: result.response.text(), type: "text" }), { status: 200, headers });
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    // MODO VISION: Flux Schnell
    if (modo === "vision") {
      const output = await replicate.run("black-forest-labs/flux-schnell", { input: { prompt } });
      return new Response(JSON.stringify({ content: "Imagem gerada!", type: "image", mediaUrl: (output as string[])[0] }), { status: 200, headers });
    }

    // MODO MOTION: Luma Ray
    if (modo === "motion") {
      const output = await replicate.run("luma/ray", { input: { prompt } });
      return new Response(JSON.stringify({ content: "Vídeo gerado!", type: "video", mediaUrl: output }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Modo não encontrado" }), { status: 400, headers });

  } catch (error: any) {
    console.error("Erro na API:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
