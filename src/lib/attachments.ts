import { supabase } from "@/integrations/supabase/client";

export type AttachmentKind = "image" | "document" | "audio";

export const DOC_ACCEPT = ".pdf,.docx,.txt,.md,.csv";
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.ogg,.webm,.flac";

const MAX_CHARS = 20000;

function clamp(text: string): string {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return clean.length > MAX_CHARS
    ? clean.slice(0, MAX_CHARS) + "\n\n[...conteúdo truncado...]"
    : clean;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker servido pelo próprio bundle (Vite resolve o ?url).
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    out += `\n\n--- Página ${i} ---\n${pageText}`;
    if (out.length > MAX_CHARS) break;
  }
  return out;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buffer = await file.arrayBuffer();
  const result = await (mammoth as any).extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

/** Extrai texto de PDF, DOCX, TXT/MD/CSV — tudo no navegador, sem custo de API. */
export async function extractDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let raw = "";

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    raw = await extractPdf(file);
  } else if (name.endsWith(".docx")) {
    raw = await extractDocx(file);
  } else if (/\.(txt|md|csv|json|log)$/.test(name) || file.type.startsWith("text/")) {
    raw = await file.text();
  } else if (name.endsWith(".doc")) {
    throw new Error("Formato .doc antigo não é suportado. Converta para .docx ou PDF.");
  } else {
    throw new Error("Formato de documento não suportado.");
  }

  const text = clamp(raw);
  if (!text) throw new Error("Não consegui extrair texto desse arquivo (pode ser um PDF digitalizado).");
  return text;
}

/** Transcreve áudio reaproveitando o Whisper já configurado na function kojak-live. */
export async function transcribeAudio(file: File, language: string): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const { data, error } = await supabase.functions.invoke("kojak-live", {
    body: { audio: base64, mimeType: file.type || "audio/webm", language, transcribeOnly: true },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const transcript = String(data?.transcript || "").trim();
  if (!transcript) throw new Error("Não consegui entender o áudio. Tente um arquivo mais nítido.");
  return clamp(transcript);
}
