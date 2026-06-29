# 🚀 Kojak IA Hub

Plataforma SaaS multimodal de inteligência artificial — chat, código, visão, vídeo e saúde. Construída com React + Supabase + OpenRouter.

## 📋 Features

✅ **Kojak Code** — Asistente de código e chat avançado (tipo Claude)
✅ **Kojak Saúde** — Especialista em medicina e ciências da vida
✅ **Kojak Vision** — Análise e geração de imagens
✅ **Kojak Motion** — Geração de vídeos realistas
✅ **Keep-Alive** — Cron job automático para manter Supabase ativo
✅ **Autenticação** — Login com Google via Supabase Auth
✅ **Real-time** — Chat em tempo real com Supabase Realtime
✅ **Sem restrições** — IA poderosa e completamente acessível

---

## 🛠️ Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Edge Functions + PostgreSQL + Auth)
- **IA:** OpenRouter (Gemini 2.5) + Replicate (vídeos)
- **Banco:** PostgreSQL com RLS policies

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente (`.env`)

```env
VITE_SUPABASE_URL=https://bhinekniyatxtvbqhjnm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaW5la255YXR4dHZicWhqbm0iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODczNTQxNywiZXhwIjoxNzY5MjcxNDE3fQ.c-G3XwUU9KM_PJ8_9HkdJUYqMuVvvJt-6eH_jfV5LkE
VITE_SUPABASE_PROJECT_ID=bhinekniyatxtvbqhjnm
```

### 2. Secrets no Supabase (Project Settings → Edge Functions → Secrets)

| Secret | Valor |
|--------|-------|
| `OPENROUTER_API_KEY` | `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` |
| `REPLICATE_API_TOKEN` | `r8_HsD16EHqvBWHoSnEOk8sqmiDrbFbRcI38P7Lc` |

**⚠️ IMPORTANTE:** Nunca commite o `.env` com chaves reais. O arquivo está no `.gitignore`.

---

## 🚀 Como Rodar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento
npm run dev

# 3. Build para produção
npm run build
```

---

## 📦 Deploy no Supabase

### Via CLI

```bash
# Login
supabase login

# Link ao projeto
supabase link --project-ref bhinekniyatxtvbqhjnm

# Deploy das Edge Functions
supabase functions deploy

# Setar secrets
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase secrets set REPLICATE_API_TOKEN=r8_HsD16EHqvBWHo...
```

### Via Dashboard

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto `kojak-ai-hub`
3. Vá em **Edge Functions**
4. Faça upload das funções em `supabase/functions/`
5. Configure os secrets em **Project Settings → Edge Functions → Secrets**

---

## 🤖 Modos de IA

| Modo | Função | Modelo | Descrição |
|------|--------|--------|-----------|
| **Chat/Código** | `kojak-code` | google/gemini-2.5-flash | IA geral, código, análise |
| **Saúde** | `kojak-saude` | google/gemini-2.5-flash | Medicina e bem-estar |
| **Visão** | `kojak-vision` | google/gemini-2.5-flash | Análise e geração de imagens |
| **Motion** | `kojak-motion` | Replicate | Geração de vídeos |
| **Keep-Alive** | `keep-alive` | Supabase SQL | Mantém projeto ativo |

---

## 🔧 Trocar de Modelo

Para usar outro modelo, edite o `model` em cada Edge Function:

```typescript
// Exemplos:
"model": "google/gemini-2.5-pro",           // Modelo mais poderoso
"model": "openai/gpt-4-turbo",              // OpenAI
"model": "anthropic/claude-3.5-sonnet",     // Claude
"model": "meta-llama/llama-3.3-70b-instruct" // Llama (gratuito)
```

---

## 📊 Keep-Alive (Cron Job)

O projeto inclui uma Edge Function `keep-alive` que roda **automaticamente todo dia às 08:00 (Brasília)** e faz ping no banco para evitar pause automático do Supabase.

Configurado em `supabase/config.toml`:

```toml
[cron."daily-keep-alive"]
schedule = "0 11 * * *"  # 11:00 UTC = 08:00 Brasília
function = "keep-alive"
```

---

## 🔐 Segurança

- ✅ RLS policies implementadas
- ✅ JWT verification onde necessário
- ✅ Chaves de API em Supabase Secrets (não no código)
- ✅ `.env` no `.gitignore`
- ✅ CORS configurado

---

## 📝 Estrutura de Pastas

```
kojak-ai-hub/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks (useAuth, useChats, etc)
│   ├── integrations/   # Supabase client, tipos
│   ├── pages/          # Páginas (Chat, Auth, etc)
│   └── App.tsx         # Root component
├── supabase/
│   ├── functions/      # Edge Functions
│   ├── migrations/     # SQL migrations
│   └── config.toml     # Config com cron job
├── .env                # Variáveis de ambiente (NÃO commitar!)
├── .gitignore          # Ignora .env e sensíveis
├── package.json        # Dependências
└── README.md           # Este arquivo
```

---

## 🐛 Troubleshooting

### "OPENROUTER_API_KEY not found"
→ Verifique se o secret foi adicionado em Supabase Secrets

### "Supabase project paused"
→ O keep-alive está desativado. Deploy a Edge Function `keep-alive` e verifique o cron job

### "Gemini 2.5 not available"
→ Use `google/gemini-2.0-flash` ou outro modelo em `supabase/functions/`

---

## 📚 Docs & Links

- [OpenRouter API](https://openrouter.ai/)
- [Supabase Docs](https://supabase.com/docs)
- [Replicate API](https://replicate.com/)
- [React Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 💬 Suporte

Para dúvidas ou problemas:
1. Cheque o console do navegador (F12)
2. Veja os logs do Supabase (Edge Functions → Logs)
3. Teste as Edge Functions diretamente via curl/Postman

---

**Kojak IA Hub** — Construído para ser tão bom quanto qualquer IA no mercado. 🚀

