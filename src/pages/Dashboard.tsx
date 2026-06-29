import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageSquare } from "lucide-react";

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-purple">Painel</h1>
            <p className="text-muted-foreground">
              Olá, {profile?.full_name || user?.email}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => navigate("/")}
            className="glass-card-strong rounded-2xl p-6 text-left hover:border-primary/50 transition-all neon-border"
          >
            <MessageSquare className="w-8 h-8 mb-3 text-primary" />
            <h2 className="text-lg font-semibold mb-1">Abrir Chat</h2>
            <p className="text-sm text-muted-foreground">
              Voltar à interface multimodal Kojak IA.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
