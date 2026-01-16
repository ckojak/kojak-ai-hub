import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  const [activeMode, setActiveMode] = useState("dashboard");

  return (
    // overflow-hidden impede que a tela inteira balance no celular
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar - Ela já tem a lógica de PC/Mobile interna */}
      <Sidebar activeMode={activeMode} onModeChange={setActiveMode} />

      {/* Main Content 
          ml-0: No celular, margem esquerda zero.
          md:ml-64: No computador, margem esquerda de 64.
          mb-16: No celular, margem embaixo para a barra de navegação não cobrir nada.
          md:mb-0: No computador, margem embaixo zero.
      */}
      <main className="flex-1 transition-all duration-300 ml-0 md:ml-64 mb-16 md:mb-0 overflow-y-auto">
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
