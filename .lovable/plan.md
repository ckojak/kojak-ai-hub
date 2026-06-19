## Objetivo

Adicionar **Login com Google** (gerenciado pelo Lovable Cloud) na tela `/auth` existente, criar uma área `/dashboard` para usuário autenticado, e proteger **todas as rotas exceto `/auth`** — redirecionando visitantes não logados para `/auth`.

## Etapas

### 1. Banco — tabela `profiles`
Migration que cria `public.profiles` (id = `auth.users.id`, `email`, `full_name`, `avatar_url`, `created_at`, `updated_at`) com:
- GRANTs para `authenticated` e `service_role`.
- RLS: cada usuário só lê/atualiza o próprio perfil; leitura pública desativada.
- Trigger `handle_new_user` em `auth.users` (AFTER INSERT) que popula `profiles` com `raw_user_meta_data` (nome/avatar vindos do Google ou do signup email/senha).
- Trigger `updated_at` automático.

### 2. Auth providers
- Habilitar **Google** (managed) via `configure_social_auth` — mantém email/senha ligado.
- `configure_auth`: `disable_signup=false`, `auto_confirm_email=false`, `external_anonymous_users_enabled=false`, `password_hibp_enabled=true`.

### 3. Frontend — Google na tela `/auth`
- Instalar `@lovable.dev/cloud-auth-js` (via tool `configure_social_auth` já gera `src/integrations/lovable/`).
- Adicionar botão **"Continuar com Google"** acima do formulário existente em `src/pages/Auth.tsx`, chamando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- Manter login/cadastro com email/senha intactos.

### 4. Rota protegida — `ProtectedRoute`
- Novo componente `src/components/ProtectedRoute.tsx` que usa `useAuth()`:
  - Enquanto `loading`: spinner.
  - Sem `user`: `<Navigate to="/auth" replace />`.
  - Com `user`: renderiza `children`.
- Em `src/App.tsx`, envolver `/` e `/dashboard` com `<ProtectedRoute>`. `/auth` permanece pública.
- Em `Auth.tsx`, se já houver sessão, redirecionar para `/`.

### 5. Página `/dashboard`
- Novo `src/pages/Dashboard.tsx`: painel do usuário com card de perfil (avatar, nome, email vindos de `profiles`), botão **Sair** (`signOut`) e atalho de volta ao chat.
- Registrar rota `/dashboard` em `App.tsx` (protegida).
- Adicionar item "Painel" no menu existente (Sidebar/BottomBar) apontando para `/dashboard` quando logado.

### 6. Validação
- Build automático.
- Conferir que `/` redireciona para `/auth` quando deslogado, que o botão Google abre o fluxo OAuth, e que `/dashboard` mostra dados do `profiles` populados pelo trigger.

## Detalhes técnicos

- `useAuth` já existe (`src/hooks/useAuth.tsx`) com `signIn`/`signUp`/`signOut` e listener `onAuthStateChange` — apenas consumido, não reescrito.
- Nenhuma edge function nova; Google é totalmente gerenciado pelo Cloud (sem precisar de Client ID/Secret do usuário).
- `auth.users` **não** recebe FK direto de outras tabelas; `profiles.id` referencia `auth.users(id)` com `ON DELETE CASCADE` (padrão Lovable).
- Tema/visual: manter Dark Futurism (glassmorphism + neon purple) já em uso no `Auth.tsx` e demais telas.

## Fora de escopo

- Reset de senha (não solicitado).
- Apple/SAML/outros provedores.
- Qualquer alteração de credenciais de backend ou troca de projeto Cloud.