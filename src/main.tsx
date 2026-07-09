import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// ⚠️ ATENÇÃO: Se o seu arquivo de idioma tiver outro nome (ex: language.tsx), mude aqui na linha de baixo:
import { LanguageProvider } from "./useLanguage.tsx"; 

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
