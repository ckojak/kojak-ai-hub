# Kojak AI Hub

Plataforma SaaS multimodal de IA — chat, código, visão, vídeo e saúde.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend:** Supabase (Edge Functions + PostgreSQL + Auth)
- **IA:** OpenRouter (acesso a múltiplos modelos)
- **Vídeo:** Replicate

---

## ⚙️ Configuração das Variáveis de Ambiente

### 1. Variáveis do Frontend (`.env`)

Crie um arquivo `.env` na raiz do projeto (nunca commite este arquivo):

```env
VITE_SUPABASE_URL=https://oqcwrqhfuhuaudgwnika.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_anon_aqui
VITE_SUPABASE_PROJECT_ID=oqcwrqhfuhuaudgwnika
```

### 2. Secrets das Edge Functions (Supabase Dashboard)

Acesse: **Supabase → Project Settings → Edge Functions → Secrets**

| Secret | Descrição | Onde obter |
|--------|-----------|------------|
| `OPENROUTER_API_KEY` | Chave da API OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `REPLICATE_API_TOKEN` | Para geração de vídeos | [replicate.com/account](https://replicate.com/account) — opcional |

---

## 🚀 Keep-Alive do Supabase

O projeto inclui uma Edge Function `keep-alive` que roda automaticamente todo dia às **08:00 horário de Brasília** via cron job, evitando que o Supabase pause o projeto por inatividade.

Para ativar, certifique-se que o `supabase/config.toml` está com a configuração do cron e faça o deploy das functions.

---

## 🤖 Modos de IA

| Modo | Função | Modelo |
|------|--------|--------|
| Chat | `kojak-code` | google/gemini-2.5-flash |
| Código | `kojak-code` | google/gemini-2.5-flash |
| Visão | `kojak-vision` | google/gemini-2.5-flash |
| Saúde | `kojak-saude` | google/gemini-2.5-flash |
| Motion | `kojak-motion` | Replicate (vídeo) |

Para trocar de modelo, edite a propriedade `model` em cada Edge Function.

---

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

---

## 📦 Deploy das Edge Functions

```bash
# Login no Supabase CLI
supabase login

# Linkar ao projeto
supabase link --project-ref oqcwrqhfuhuaudgwnika

# Deploy de todas as functions
supabase functions deploy

# Adicionar secrets
supabase secrets set OPENROUTER_API_KEY=sua_chave_aqui
```
