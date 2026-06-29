import { Code2, Camera, Play, Zap, TrendingUp, Clock, Sparkles, ArrowRight } from "lucide-react";

const stats = [
  { label: "Gerações Totais", value: "2,534", icon: Sparkles, trend: "+18%" },
  { label: "Imagens Criadas", value: "856", icon: Camera, trend: "+8%" },
  { label: "Vídeos Produzidos", value: "142", icon: Play, trend: "+23%" },
  { label: "Tempo Economizado", value: "96h", icon: Clock, trend: "+15%" },
];

const recentActivity = [
  { type: "code", title: "Script de Automação Python", time: "2 min atrás" },
  { type: "vision", title: "Conceito de Cidade Cyberpunk", time: "15 min atrás" },
  { type: "motion", title: "Animação de Logo 3D", time: "1 hora atrás" },
];

export function Dashboard() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Aurora effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] rounded-full bg-secondary/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
        
        <div className="text-center mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full glass-card">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-medium text-primary/80 tracking-wider uppercase">Motor Neural v2.0 Ativo</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 tracking-tight leading-tight">
            Crie o Impossível com <br />
            <span className="text-gradient-purple">Kojak IA</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Sua central de comando multimodal. Transforme ideias em código, imagens e vídeos cinematográficos em segundos.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16 w-full">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group relative p-6 rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary group-hover:text-primary transition-colors">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground mb-1 tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-400" /> Iniciar Criação
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <QuickActionCard icon={Code2} title="Kojak Code" description="Desenvolvimento assistido" accentColor="hover:border-secondary/50 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.2)]" iconBg="from-secondary/20 to-secondary/10" iconColor="text-secondary" />
              <QuickActionCard icon={Camera} title="Kojak Vision" description="Geração de imagem 4K" accentColor="hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)]" iconBg="from-primary/20 to-primary/10" iconColor="text-primary" />
              <QuickActionCard icon={Play} title="Kojak Motion" description="Produção de vídeo IA" accentColor="hover:border-destructive/50 hover:shadow-[0_0_20px_hsl(var(--destructive)/0.2)]" iconBg="from-destructive/20 to-destructive/10" iconColor="text-destructive" />
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-secondary" /> Últimas Gerações
            </h2>
            <div className="glass-card rounded-2xl overflow-hidden flex-1">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                    {activity.type === "code" && <Code2 className="w-4 h-4" />}
                    {activity.type === "vision" && <Camera className="w-4 h-4" />}
                    {activity.type === "motion" && <Play className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, accentColor, iconBg, iconColor }: any) {
  return (
    <button className={`group relative flex flex-col p-5 rounded-2xl glass-card text-left transition-all duration-300 hover:-translate-y-1 ${accentColor}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${iconBg} opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity duration-500`} />
      <div className="relative">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconBg} ${iconColor} w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
