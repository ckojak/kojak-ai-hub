import { useState } from "react"; // 'import' corrigido para minúsculo
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  const [activeMode, setActiveMode] = useState("dashboard");

  return (
    // 'overflow-hidden' evita que a tela balance no celular
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Automática (Baixo no celular / Lado no PC) */}
      <Sidebar activeMode={activeMode} onModeChange={setActiveMode} />

      {/* Main Content 
          ml-0: Sem margem no celular
          md:ml-64: Margem de 256px apenas no computador
          mb-16: Espaço embaixo para a barra no celular
          md:mb-0: Sem espaço embaixo no computador
      */}
      <main className="flex-1 relative overflow-y-auto transition-all duration-300 ml-0 md:ml-64 mb-16 md:mb-0">
        {activeMode === "dashboard" ? (
          <Dashboard />
        ) : (
          <ChatArea mode={activeMode} />
        )}
      </main>
    </div>
  );
};

export default Index;
