const LANGUAGE_NAMES: Record<string, string> = {
  pt: "português do Brasil",
  en: "English",
  es: "español",
  de: "Deutsch",
  zh: "中文（简体）",
};

/** Gera a instrução de idioma pro system prompt, com base no idioma escolhido no app. */
export function languageInstruction(language?: string): string {
  const lang = (language || "pt").toLowerCase();
  if (lang === "pt") return "";
  const name = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.pt;
  return `\n\n## IDIOMA OBRIGATÓRIO\nResponda SEMPRE em ${name}, independente do idioma em que o usuário escreveu, a menos que ele peça explicitamente outro idioma.`;
}