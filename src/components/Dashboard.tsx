import { Code2, Camera, Play, Zap, TrendingUp, Clock } from "lucide-react";

const stats = [
  { label: "Códigos Gerados", value: "1,234", icon: Code2, trend: "+12%" },
  { label: "Imagens Criadas", value: "856", icon: Camera, trend: "+8%" },
  { label: "Vídeos Produzidos", value: "142", icon: Play, trend: "+23%" },
  { label: "Tempo Economizado", value: "48h", icon: Clock, trend: "+15%" },
];

const recentActivity = [
  { type: "code", title: "API REST em Python", time: "2 min atrás" },
  { type: "vision", title: "Logo minimalista", time: "15 min atrás" },
  { type: "motion", title: "Vídeo promocional", time: "1 hora atrás" },
];

export function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 animate-fade-in flex flex-col items-center">
      
      {/* Header Centralizado */}
      <div className="mb-12 text-center flex flex-col items-center">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
          Bem-vindo ao <span className="text-primary">Kojak AI</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Sua plataforma de inteligência artificial multimodal
        </p>
      </div>

      {/* Stats Grid - Centralizado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 w-full">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="p-5 rounded-xl bg-kojak-surface border border-kojak-border flex flex-col items-center text-center group hover:border-primary/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary mb-3">
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-center gap-1 text-[10px] text-green-400 mt-2">
              <TrendingUp className="w-3 h-3" /> {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Centralizadas */}
      <div className="w-full mb-10">
        <h2 className="text-lg font-semibold text-center mb-6">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            icon={Code2}
            title="Novo Código"
            description="Gere código em qualquer linguagem"
            gradient="from-blue-500 to-cyan-500"
          />
          <QuickActionCard
            icon={Camera}
            title="Nova Imagem"
            description="Crie imagens profissionais com IA"
            gradient="from-purple-500 to-pink-500"
          />
          <QuickActionCard
            icon={Play}
            title="Novo Vídeo"
            description="Produza vídeos em alta definição"
            gradient="from-orange-500 to-red-500"
          />
        </div>
      </div>

      {/* Atividade Recente - Ocupa a largura total mas com estilo limpo */}
      <div className="w-full max-w-2xl">
        <h2 className="text-lg font-semibold text-center mb-4">Atividade Recente</h2>
        <div className="bg-kojak-surface border border-kojak-border rounded-xl overflow-hidden">
          {recentActivity.map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-4 px-5 py-4 border-b border-kojak-border/50 last:border-0 hover:bg-kojak-charcoal/50 transition-colors"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                {activity.type === "code" && <Code2 className="w-4 h-4 text-blue-400" />}
                {activity.type === "vision" && <Camera className="w-4 h-4 text-green-400" />}
                {activity.type === "motion" && <Play className="w-4 h-4 text-orange-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
              <Zap className="w-4 h-4 text-primary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, gradient }: any) {
  return (
    <button className="flex flex-col items-center text-center group p-6 rounded-2xl bg-kojak-surface border border-kojak-border hover:border-primary/30 transition-all w-full">
      <div className={`p-4 rounded-xl bg-gradient-to-br ${gradient} mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
