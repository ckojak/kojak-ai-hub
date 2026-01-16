import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  const [activeMode, setActiveMode] = useState("dashboard");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar activeMode={activeMode} onModeChange={setActiveMode} />

      {/* Main Content */}
      <main className="flex-1 ml-64 transition-all duration-300">
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
