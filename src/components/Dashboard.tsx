import { Code2, Camera, Play, Zap, TrendingUp, Clock, Sparkles, ArrowRight } from "lucide-react";

// Dados de exemplo (mantidos os mesmos)
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
    // Container principal com "overflow-hidden" para conter os efeitos de luz de fundo
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030014] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* --- EFEITOS DE FUNDO FUTURISTAS (Auroras) --- */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse-slow delay-1000 pointer-events-none" />
      <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

      {/* --- CONTEÚDO PRINCIPAL (Com Z-Index para ficar acima do fundo) --- */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
        
        {/* Header Centralizado com Gradiente Futurista */}
        <div className="text-center mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-xs font-medium text-purple-200 tracking-wider uppercase">Motor Neural v2.0 Ativo</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Crie o Impossível com <br />
            {/* Gradiente de texto complexo para efeito neon */}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-500 to-cyan-400 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              Kojak AI
            </span>
          </h1>
          <p className="text-lg text-blue-200/70 max-w-xl mx-auto leading-relaxed">
            Sua central de comando multimodal. Transforme ideias em código, imagens e vídeos cinematográficos em segundos.
          </p>
        </div>

        {/* Stats Grid - Estilo "Vidro Neon" */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16 w-full">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              // Classes para o efeito de vidro e brilho na borda ao passar o mouse
              className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg overflow-hidden transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:-translate-y-1"
            >
              {/* Efeito de brilho interno sutil */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 text-purple-300 group-hover:text-purple-100 transition-colors">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-1 tracking-tight">{stat.value}</p>
                <p className="text-xs text-blue-200/60 uppercase tracking-widest font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Seção de Ações Rápidas e Atividade */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full">
          
          {/* Ações Rápidas (Ocupa 3/5 do espaço no PC) */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Iniciar Criação
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
               <QuickActionCard
                  icon={Code2}
                  title="Kojak Code"
                  description="Desenvolvimento assistido"
                  accentColor="group-hover:border-blue-500/50 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                  iconBg="from-blue-400/20 to-cyan-400/20"
                  iconColor="text-blue-300"
                />
                <QuickActionCard
                  icon={Camera}
                  title="Kojak Vision"
                  description="Geração de imagem 4K"
                  accentColor="group-hover:border-purple-500/50 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                  iconBg="from-purple-400/20 to-pink-400/20"
                  iconColor="text-purple-300"
                />
                <QuickActionCard
                  icon={Play}
                  title="Kojak Motion"
                  description="Produção de vídeo IA"
                  accentColor="group-hover:border-orange-500/50 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]"
                  iconBg="from-orange-400/20 to-red-400/20"
                  iconColor="text-orange-300"
                />
            </div>
          </div>

          {/* Atividade Recente (Ocupa 2/5 do espaço no PC) */}
          <div className="lg:col-span-2 flex flex-col gap-5">
             <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" /> Últimas Gerações
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden flex-1">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-white/10 text-blue-200 group-hover:text-white transition-colors">
                    {activity.type === "code" && <Code2 className="w-4 h-4" />}
                    {activity.type === "vision" && <Camera className="w-4 h-4" />}
                    {activity.type === "motion" && <Play className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                    <p className="text-xs text-blue-200/50">{activity.time}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para os cartões de ação rápida com estilo futurista
function QuickActionCard({ icon: Icon, title, description, accentColor, iconBg, iconColor }: any) {
  return (
    <button className={`group relative flex flex-col p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg text-left transition-all duration-300 hover:-translate-y-1 ${accentColor}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${iconBg} opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity duration-500`} />
      
      <div className="relative">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconBg} ${iconColor} w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-200 transition-all">
            {title}
        </h3>
        <p className="text-sm text-blue-200/60">{description}</p>
      </div>
    </button>
  );
}
