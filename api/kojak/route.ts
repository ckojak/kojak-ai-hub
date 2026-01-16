import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { prompt, modo } = await req.json();
    const headers = { "Content-Type": "application/json" };

    if (modo === "code") {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      return new Response(JSON.stringify({ content: result.response.text(), type: "code" }), { status: 200, headers });
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    if (modo === "vision") {
      const output = await replicate.run("black-forest-labs/flux-schnell", { input: { prompt } });
      return new Response(JSON.stringify({ content: "Pronto!", type: "image", mediaUrl: (output as string[])[0] }), { status: 200, headers });
    }

    if (modo === "motion") {
      const output = await replicate.run("luma/ray", { input: { prompt } });
      return new Response(JSON.stringify({ content: "Vídeo pronto!", type: "video", mediaUrl: output }), { status: 200, headers });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
