## Diagnóstico

Varredura completa:

- **Frontend**: apenas 1 resquício Lovable — `src/pages/Auth.tsx` ainda importa `@/integrations/lovable` (pasta já deletada → build quebrado) e usa `lovable.auth.signInWithOAuth` no botão Google.
- **`Index.tsx`, `ChatArea.tsx`, `useChats.ts`**: limpos. Chamam apenas `supabase.functions.invoke()` / `supabase.from()`.
- **Edge Functions**: **nenhuma** usa `ai.gateway.lovable.dev` nem SDK Lovable. Já batem diretamente em `openrouter.ai` (kojak-code/vision/saude) e `api.replicate.com` (kojak-motion) com `Bearer ${OPENROUTER_API_KEY}` / `Bearer ${REPLICATE_API_TOKEN}`. Os "créditos Lovable" percebidos vêm de outra origem (provavelmente uso do editor, não runtime do app).
- **Blindagem parcial**: funções já têm try/catch e CORS, mas alguns caminhos ainda fazem `throw` que retorna 500. Precisam sempre devolver JSON `{ error }` com status controlado.

## Plano (mudanças mínimas e cirúrgicas)

### 1. Auth.tsx — remover Lovable, usar Supabase OAuth nativo
- Remover `import { lovable } from "@/integrations/lovable"`.
- Reescrever `handleGoogle` para:
  ```ts
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
  ```
- Sem outras mudanças de UI.

### 2. Replicate token — corrigir prefixo
- `kojak-motion` usa `Bearer ${REPLICATE_API_TOKEN}`. O padrão Replicate aceita `Bearer`, mas a diretriz pede `Token`. Trocar por `Token ${...}` conforme solicitado.

### 3. Blindagem anti-crash das 4 edge functions (kojak-code, kojak-vision, kojak-motion, kojak-saude)
- Substituir cada `throw new Error(...)` dentro do handler por `return new Response(JSON.stringify({ error: msg }), { status: 400, headers: {...corsHeaders, "Content-Type": "application/json"} })`.
- Garantir que o `catch` externo nunca deixe vazar 500: sempre `status: 200` com `{ error }` no corpo (conforme diretriz), preservando `corsHeaders`.
- Manter OPTIONS preflight já existente.

### 4. Nada a mexer
- `Index.tsx`, `ChatArea.tsx`, `useChats.ts`, `keep-alive`, `supabase/client.ts`, `.env` — já conformes.

## Arquivos alterados
- `src/pages/Auth.tsx`
- `supabase/functions/kojak-code/index.ts`
- `supabase/functions/kojak-vision/index.ts`
- `supabase/functions/kojak-motion/index.ts`
- `supabase/functions/kojak-saude/index.ts`

## Nota sobre "créditos Lovable"
Runtime do app não consome mais créditos Lovable — nenhuma chamada sai para `ai.gateway.lovable.dev`. Créditos exibidos referem-se ao **editor** (esta conversa/build), não à execução da aplicação publicada.

Posso aplicar?