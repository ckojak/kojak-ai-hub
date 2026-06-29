# 🚀 Guia de Deploy — Kojak IA Hub

Instruções passo a passo para fazer deploy do projeto no GitHub e Supabase.

---

## 1️⃣ Preparar o Repositório GitHub

### Se for primeira vez:

```bash
# Inicialize o git no projeto
git init

# Adicione o repositório remoto
git remote add origin https://github.com/ckojak/kojak-ai-hub.git

# Adicione todos os arquivos (exceto .env e node_modules)
git add .

# Commit inicial
git commit -m "🚀 Kojak IA Hub - Versão 2.0 com OpenRouter e Keep-Alive"

# Push para main
git branch -M main
git push -u origin main
```

### Se já existe repositório:

```bash
# Certifique-se de estar na branch main
git checkout main

# Adicione os arquivos atualizados
git add .

# Commit
git commit -m "🔄 Update: Chaves OpenRouter/Replicate, melhorias Edge Functions, keep-alive cron"

# Push
git push origin main
```

---

## 2️⃣ Configurar Supabase (Dashboard)

### A. Adicionar Secrets

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione projeto `kojak-ai-hub` (ID: `bhinekniyatxtvbqhjnm`)
3. Vá em **Project Settings → Edge Functions → Secrets**
4. Clique em **Add new secret** e adicione:

| Nome | Valor |
|------|-------|
| `OPENROUTER_API_KEY` | `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` |
| `REPLICATE_API_TOKEN` | `r8_HsD16EHqvBWHoSnEOk8sqmiDrbFbRcI38P7Lc` |

### B. Deploy das Edge Functions

#### Opção 1: Via Dashboard (Simples)

1. Em **Edge Functions → Functions**, clique em cada função:
   - `kojak-code`
   - `kojak-saude`
   - `kojak-vision`
   - `kojak-motion`
   - `keep-alive`

2. Copie o código de `supabase/functions/{nome}/index.ts`
3. Cole no editor do Supabase
4. Clique em **Deploy**

#### Opção 2: Via CLI (Recomendado)

```bash
# 1. Instale Supabase CLI
# macOS/Linux:
brew install supabase/tap/supabase

# Windows (via Scoop):
scoop install supabase

# 2. Login
supabase login

# 3. Link ao projeto
supabase link --project-ref bhinekniyatxtvbqhjnm

# 4. Deploy todas as functions
supabase functions deploy

# 5. Verificar status
supabase functions list
```

---

## 3️⃣ Verificar Deploy

### Testar Edge Functions

```bash
# Test kojak-code
curl -X POST https://bhinekniyatxtvbqhjnm.supabase.co/functions/v1/kojak-code \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Olá, como você funciona?", "stream":false}'
```

Onde `ANON_KEY` é a chave pública do projeto (encontrada em Project Settings).

### Verificar Cron Job

1. Vá em Supabase Dashboard
2. **Edge Functions → Logs**
3. Procure por funções `keep-alive`
4. Deve ver execuções diárias às 08:00 (Brasília)

---

## 4️⃣ Frontend Deploy (Opcional - Lovable)

Se estiver usando Lovable:

1. Acesse [lovable.dev](https://lovable.dev)
2. Selecione projeto `Kojak AI Hub`
3. Vá em **Publish**
4. Escolha versão e clique em **Deploy**

URL será algo como: `https://kojak-ai.app`

---

## 5️⃣ Configuração Pós-Deploy

### Verificar Variáveis de Ambiente

No seu `.env` local, certifique-se de ter:

```env
VITE_SUPABASE_URL=https://bhinekniyatxtvbqhjnm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=bhinekniyatxtvbqhjnm
```

### Testar Localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:5173 e teste:
- Fazer login com Google
- Conversar com Kojak
- Testar cada modo (Code, Saúde, Vision, Motion)

---

## ⚠️ Troubleshooting

### Erro: "OPENROUTER_API_KEY not found"
- Verifique em **Supabase → Project Settings → Edge Functions → Secrets**
- Confirme que o secret foi salvo (deve mostrar "Updated successfully")
- Redeploy a função

### Erro: "Supabase project paused"
- O keep-alive não rodou
- Certifique-se que `supabase/config.toml` tem a seção `[cron."daily-keep-alive"]`
- Deploy a função `keep-alive`
- Aguarde até a próxima execução agendada (11:00 UTC)

### Erro: "Model not available"
- OpenRouter pode ter desativado o modelo
- Edite `supabase/functions/kojak-code/index.ts`
- Troque `"model": "google/gemini-2.5-flash"` por outro:
  ```typescript
  "model": "openai/gpt-4-turbo"           // GPT-4
  "model": "anthropic/claude-3.5-sonnet"  // Claude
  "model": "google/gemini-2.5-pro"        // Gemini Pro
  ```
- Redeploy: `supabase functions deploy`

### Imagens/Vídeos não funcionam
- Verifique se `REPLICATE_API_TOKEN` está configurado
- Teste a chave em https://replicate.com/account
- Se usar OpenRouter para visão/motion, atualize o `model` nas functions

---

## 🎯 Checklist de Deploy Final

- [ ] `.env` atualizado localmente
- [ ] Código enviado para GitHub (`git push origin main`)
- [ ] Secrets adicionados no Supabase Dashboard
- [ ] Edge Functions deployadas (5 functions)
- [ ] `supabase/config.toml` com cron job
- [ ] Teste local funcionando (`npm run dev`)
- [ ] Keep-alive aparecendo nos logs
- [ ] Chats salvando no banco
- [ ] IA respondendo em todos os modos

---

## 📞 Suporte Rápido

- **OpenRouter**: https://openrouter.ai/status
- **Supabase Status**: https://status.supabase.com
- **Replicate Status**: https://status.replicate.com

Pronto! Seu Kojak IA está online 🚀

