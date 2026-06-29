# Plano de Refatoração para Produção

## Aviso importante sobre o backend

Você pediu para usar seu **novo projeto Supabase próprio (`bhinekniyatxtvbqhjnm`)** como fonte de verdade. Preciso ser transparente sobre duas restrições reais antes de começar:

1. **O Lovable Cloud não pode ser desconectado deste projeto.** Mesmo que o `.env` aponte para o seu Supabase próprio, o backend gerenciado continua existindo em paralelo. O que eu posso fazer é deixar o **código** 100% portátil e fazer ele consumir só o seu projeto novo — assim, em qualquer VPS/Vercel rodando o repo, ele usa exclusivamente o `bhinekniyatxtvbqhjnm`.
2. **Não tenho acesso ao painel do seu Supabase próprio.** Migrações de schema, RLS, deploy de Edge Functions e config de OAuth no projeto novo você roda manualmente (eu entrego os arquivos SQL/TS prontos). Os tools de migração só atuam no Lovable Cloud.

Se isso estiver ok, sigo. Caso contrário, me avise para reavaliar.

---

## Fase 1 — Desacoplamento e Segurança (entregável revisável)

**Objetivo:** remover qualquer dependência proprietária Lovable e blindar segredos.

- Remover `@lovable.dev/cloud-auth-js` e a pasta `src/integrations/lovable/`.
- Reescrever `handleGoogle` em `src/pages/Auth.tsx` usando `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${window.location.origin}/auth/callback\` } })`.
- Criar página pública `/auth/callback` que processa o retorno OAuth e redireciona.
- Adicionar `src/components/ProtectedRoute.tsx` baseado em `useAuth` + `supabase.auth.getUser()` (revalida server-side, não confia só na sessão local).
- Criar rota `/dashboard` protegida.
- Auditar `.env`: garantir que só `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (todos públicos por design) existem no frontend. Procurar por qualquer `service_role`/segredo vazado.
- Entregar pacote SQL para você rodar no seu Supabase próprio: schema completo (`profiles`, `chats`, `messages`, `conversations`, `activity_log`, `connected_apps`, `_kojak_configs`), todos os `GRANT`s, RLS, trigger `handle_new_user`, bucket `chat-attachments`.
- Entregar as 5 Edge Functions (`kojak-code`, `kojak-vision`, `kojak-motion`, `kojak-saude`, `keep-alive`) prontas para `supabase functions deploy` no projeto novo, com instruções claras de como setar `OPENROUTER_API_KEY` lá.

**Você revisa antes da Fase 2.**

## Fase 2 — Performance e Bundle

- Lazy load de rotas: `Auth`, `Dashboard`, `NotFound`, `SettingsPanel`, `ChatHistory` via `React.lazy` + `Suspense`.
- Code-split dos componentes pesados (`ChatMessage` com markdown/syntax highlight, `Dashboard`).
- `vite.config.ts`: `manualChunks` separando `react-vendor`, `supabase`, `ui` (radix), `markdown`.
- Rodar `bunx depcheck` + `knip` para listar e remover imports e dependências mortas (relatório no final).
- Substituir ícones lucide individuais por imports nomeados (já estão, mas auditar).
- `React.memo` em `ChatMessage`, `useCallback` nas handlers de `ChatArea` que recriam função a cada render.

## Fase 3 — Estabilidade (race conditions, leaks, errors)

- **ErrorBoundary global** em `App.tsx` + boundary por rota lazy.
- **useAuth**: corrigir race entre `onAuthStateChange` e `getSession` inicial (hoje o `setLoading(false)` pode disparar duas vezes); usar `mounted` flag e `AbortController` no fetchProfile.
- **useChats**: o canal realtime pode vazar quando `currentChat` muda rapidamente — adicionar guard e cleanup correto. `fetchMessages` precisa de cancelamento para evitar setState em componente desmontado.
- **useVoice**: garantir que `SpeechRecognition` e `speechSynthesis` são cancelados em unmount.
- Try/catch em todos os `supabase.from(...).insert/update/delete` com toast de erro padronizado (helper `src/lib/handleError.ts`).
- Validação Zod no payload das Edge Functions + CORS uniformizado.
- Confirmar que toda autorização vem de RLS no Supabase (nada de "se user.role === admin" só no front).

## Detalhes técnicos

```text
src/
├─ components/
│  ├─ ErrorBoundary.tsx          (novo)
│  └─ ProtectedRoute.tsx         (novo)
├─ pages/
│  ├─ Auth.tsx                   (signInWithOAuth nativo)
│  ├─ AuthCallback.tsx           (novo, rota pública)
│  └─ Dashboard.tsx              (novo, protegida)
├─ integrations/
│  └─ supabase/client.ts         (mantido, já é nativo)
│  └─ lovable/                   (DELETADO)
├─ lib/
│  └─ handleError.ts             (novo, util DRY)
└─ hooks/
   ├─ useAuth.tsx                (race fix + getUser revalidação)
   ├─ useChats.ts                (cleanup realtime + abort)
   └─ useVoice.ts                (cleanup em unmount)

supabase/migrations/             (gerado para você rodar no projeto novo)
supabase/functions/*             (sem mudança estrutural, só CORS+Zod)
```

## Relatório final (entrego após Fase 3)

Documento curto cobrindo: dependências removidas, bundle antes/depois, lista de race conditions corrigidas, checklist de RLS por tabela, e passo-a-passo para você rodar tudo no seu Supabase próprio + deploy Vercel.

---

**Posso começar pela Fase 1?**