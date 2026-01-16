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
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
          Bem-vindo ao <span className="text-primary">Kojak AI</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Sua plataforma de inteligência artificial multimodal
        </p>
      </div>

      {/* Stats Grid - Centralizado no Mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 w-full">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="p-5 rounded-xl bg-kojak-surface border border-kojak-border flex flex-col items-center text-center group"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary mb-3">
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Ações Rápidas */}
      <div className="w-full mb-10">
        <h2 className="text-lg font-semibold text-center md:text-left mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard icon={Code2} title="Novo Código" description="Gere scripts profissionais" gradient="from-blue-600 to-purple-600" />
          <QuickActionCard icon={Camera} title="Nova Imagem" description="Criações visuais em 4K" gradient="from-purple-600 to-pink-600" />
          <QuickActionCard icon={Play} title="Novo Vídeo" description="Cinema com IA generativa" gradient="from-pink-600 to-orange-600" />
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, gradient }: any) {
  return (
    <button className="flex flex-col items-center text-center p-6 rounded-2xl bg-kojak-surface border border-kojak-border hover:border-primary/50 transition-all w-full">
      <div className={`p-4 rounded-full bg-gradient-to-br ${gradient} mb-4 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
