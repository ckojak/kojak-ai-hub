import { useState, useEffect } from "react";
import { 
  X, 
  History, 
  Brain, 
  Plug, 
  Palette, 
  MapPin, 
  User,
  Sun,
  Moon,
  Monitor,
  Trash2,
  ChevronRight,
  LogOut,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActivityItem {
  id: string;
  action: string;
  details: any;
  created_at: string;
}

const themeOptions = [
  { id: "system", label: "Sistema", icon: Monitor },
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
] as const;

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [personalContext, setPersonalContext] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const { user, profile, signOut, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Fetch activity log
  useEffect(() => {
    if (open && user) {
      fetchActivities();
      if (profile?.personal_context) {
        setPersonalContext(profile.personal_context);
      }
      if (profile?.location) {
        setLocation(profile.location);
      }
    }
  }, [open, user, profile]);

  // Detect location on mount
  useEffect(() => {
    if (open && !location) {
      detectLocation();
    }
  }, [open]);

  const fetchActivities = async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setActivities(data);
    }
  };

  const detectLocation = async () => {
    setLoadingLocation(true);
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      const locationStr = `${data.city}, ${data.region}`;
      setLocation(locationStr);
      
      if (user) {
        await updateProfile({ location: locationStr });
      }
    } catch (error) {
      console.error("Failed to detect location:", error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSaveContext = async () => {
    setSaving(true);
    const { error } = await updateProfile({ personal_context: personalContext });
    setSaving(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o contexto.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Salvo!",
        description: "Contexto pessoal atualizado.",
      });
    }
  };

  const handleClearActivities = async () => {
    const { error } = await supabase
      .from("activity_log")
      .delete()
      .eq("user_id", user?.id);

    if (!error) {
      setActivities([]);
      toast({
        title: "Histórico limpo",
        description: "Todas as atividades foram removidas.",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const menuItems = [
    { id: "activity", label: "Atividade", icon: History },
    { id: "context", label: "Contexto Pessoal", icon: Brain },
    { id: "apps", label: "Apps Conectados", icon: Plug },
    { id: "theme", label: "Tema", icon: Palette },
    { id: "location", label: "Localização", icon: MapPin },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "activity":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Histórico de Atividades</h3>
              {activities.length > 0 && (
                <button
                  onClick={handleClearActivities}
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar tudo
                </button>
              )}
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma atividade registrada ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto chat-scrollbar">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded-xl glass-card text-sm"
                  >
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "context":
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Contexto Pessoal</h3>
            <p className="text-sm text-muted-foreground">
              Adicione informações que a Kojak IA deve lembrar sobre você para personalizar as respostas.
            </p>
            <Textarea
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
              placeholder="Ex: Sou desenvolvedor web, prefiro exemplos em TypeScript, trabalho com React..."
              className="min-h-[150px] bg-white/5 border-white/10"
            />
            <button
              onClick={handleSaveContext}
              disabled={saving}
              className="w-full py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Contexto"
              )}
            </button>
          </div>
        );

      case "apps":
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Apps Conectados</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie as integrações externas da sua conta.
            </p>
            <div className="text-center py-8 glass-card rounded-xl">
              <Plug className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                Nenhum app conectado ainda.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Em breve você poderá conectar Google Drive, Notion e mais.
              </p>
            </div>
          </div>
        );

      case "theme":
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Tema</h3>
            <p className="text-sm text-muted-foreground">
              Escolha como a interface deve aparecer.
            </p>
            <div className="space-y-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl transition-all",
                      isActive
                        ? "bg-primary/20 border border-primary/30"
                        : "glass-card hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                    <span className={cn(isActive && "text-primary font-medium")}>
                      {option.label}
                    </span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "location":
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Localização</h3>
            <p className="text-sm text-muted-foreground">
              Sua localização é usada para personalizar respostas.
            </p>
            <div className="p-4 rounded-xl glass-card flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              {loadingLocation ? (
                <span className="text-sm text-muted-foreground">Detectando...</span>
              ) : location ? (
                <span className="text-sm">{location}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Localização não detectada</span>
              )}
            </div>
            <button
              onClick={detectLocation}
              disabled={loadingLocation}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <MapPin className="w-4 h-4" />
              Atualizar localização
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[90vw] max-w-md p-0 border-l border-white/10 bg-black/95 backdrop-blur-xl"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">
              {activeSection ? menuItems.find((m) => m.id === activeSection)?.label : "Configurações"}
            </h2>
            <button
              onClick={() => activeSection ? setActiveSection(null) : onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection ? (
              <div className="animate-fade-in">
                <button
                  onClick={() => setActiveSection(null)}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
                >
                  ← Voltar
                </button>
                {renderContent()}
              </div>
            ) : (
              <div className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl glass-card hover:bg-white/5 transition-all group"
                    >
                      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Profile Footer */}
          {user && profile && !activeSection && (
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl glass-card">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-purple text-white">
                    {profile.full_name?.charAt(0).toUpperCase() || "K"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {profile.full_name || "Usuário"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.email || user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sair da conta</span>
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
