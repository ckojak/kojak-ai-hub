import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "pt" | "en" | "es" | "de" | "zh";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

// Dicionário de traduções. Para adicionar mais textos, adicione a chave aqui
// e a tradução correspondente em cada idioma.
const translations: Record<Language, Record<string, string>> = {
  pt: {
    settings: "Configurações",
    history: "Histórico",
    personalization: "Personalização",
    connections: "Conexões",
    appearance: "Aparência",
    language: "Idioma",
    languageDescription: "Escolha o idioma do aplicativo. O idioma principal é o Português.",
    account: "Conta",
    logout: "Sair da conta",
    login: "Fazer login",
    loginDescription: "Entre para salvar suas conversas e preferências.",
    theme: "Tema",
    light: "Claro",
    dark: "Escuro",
    system: "Sistema",
    clearHistory: "Limpar histórico",
    newChat: "Nova conversa",
    typeMessage: "Digite sua mensagem...",
    fastMode: "Rápido",
    proMode: "Avançado",
  },
  en: {
    settings: "Settings",
    history: "History",
    personalization: "Personalization",
    connections: "Connections",
    appearance: "Appearance",
    language: "Language",
    languageDescription: "Choose the app language. The primary language is Portuguese.",
    account: "Account",
    logout: "Sign out",
    login: "Sign in",
    loginDescription: "Sign in to save your conversations and preferences.",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    clearHistory: "Clear history",
    newChat: "New chat",
    typeMessage: "Type your message...",
    fastMode: "Fast",
    proMode: "Advanced",
  },
  es: {
    settings: "Configuración",
    history: "Historial",
    personalization: "Personalización",
    connections: "Conexiones",
    appearance: "Apariencia",
    language: "Idioma",
    languageDescription: "Elige el idioma de la aplicación. El idioma principal es el portugués.",
    account: "Cuenta",
    logout: "Cerrar sesión",
    login: "Iniciar sesión",
    loginDescription: "Inicia sesión para guardar tus conversaciones y preferencias.",
    theme: "Tema",
    light: "Claro",
    dark: "Oscuro",
    system: "Sistema",
    clearHistory: "Borrar historial",
    newChat: "Nueva conversación",
    typeMessage: "Escribe tu mensaje...",
    fastMode: "Rápido",
    proMode: "Avanzado",
  },
  de: {
    settings: "Einstellungen",
    history: "Verlauf",
    personalization: "Personalisierung",
    connections: "Verbindungen",
    appearance: "Erscheinungsbild",
    language: "Sprache",
    languageDescription: "Wähle die Sprache der App. Die Hauptsprache ist Portugiesisch.",
    account: "Konto",
    logout: "Abmelden",
    login: "Anmelden",
    loginDescription: "Melde dich an, um deine Unterhaltungen und Einstellungen zu speichern.",
    theme: "Design",
    light: "Hell",
    dark: "Dunkel",
    system: "System",
    clearHistory: "Verlauf löschen",
    newChat: "Neue Unterhaltung",
    typeMessage: "Nachricht eingeben...",
    fastMode: "Schnell",
    proMode: "Erweitert",
  },
  zh: {
    settings: "设置",
    history: "历史记录",
    personalization: "个性化",
    connections: "连接",
    appearance: "外观",
    language: "语言",
    languageDescription: "选择应用语言。主要语言是葡萄牙语。",
    account: "账户",
    logout: "退出登录",
    login: "登录",
    loginDescription: "登录以保存您的对话和偏好设置。",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    system: "系统",
    clearHistory: "清除历史记录",
    newChat: "新对话",
    typeMessage: "输入消息...",
    fastMode: "快速",
    proMode: "高级",
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "kojak-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    return saved && translations[saved] ? saved : "pt";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);

  const t = (key: string): string => {
    return translations[language]?.[key] ?? translations.pt[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage precisa estar dentro de um LanguageProvider");
  return ctx;
}