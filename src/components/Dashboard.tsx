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
  { type: "code", title: "Dashboard React", time: "3 horas atrás" },
];

export function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Bem-vindo ao <span className="text-gradient-purple">Kojak AI</span>
        </h1>
        <p className="text-muted-foreground">
          Sua plataforma de inteligência artificial multimodal
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="p-5 rounded-xl bg-kojak-surface border border-kojak-border hover:border-primary/30 transition-all duration-300 group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                {stat.trend}
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
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
            gradient="from-green-500 to-emerald-500"
          />
          <QuickActionCard
            icon={Play}
            title="Novo Vídeo"
            description="Produza vídeos em alta definição"
            gradient="from-orange-500 to-red-500"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h2>
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

function QuickActionCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <button className="group p-5 rounded-xl bg-kojak-surface border border-kojak-border hover:border-primary/30 transition-all duration-300 text-left">
      <div
        className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4 group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
