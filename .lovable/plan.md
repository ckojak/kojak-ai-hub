

## Plano: Deploy das Edge Functions, Setup de Storage e Validação Completa

Vou reativar a infraestrutura Cloud, fazer deploy das 3 Edge Functions atualizadas, criar o bucket de storage e validar tudo com testes reais (memória conversacional, tom Gemini, e os 3 cenários do Kojak Vision).

### Etapa 1 — Infraestrutura Supabase

1. **Migration do bucket de storage** (`chat-attachments`):
   - Criar bucket público `chat-attachments`
   - RLS policy: usuários autenticados podem fazer upload
   - RLS policy: leitura pública para servir as imagens nos chats

2. **Deploy das 3 Edge Functions** já refatoradas:
   - `kojak-code` (chat + código + multimodal com persona Gemini)
   - `kojak-vision` (4 cenários: texto puro, edição, referência, face swap)
   - `kojak-motion` (geração de vídeo via Replicate)

### Etapa 2 — Validação automatizada via curl

Vou disparar chamadas reais nas funções deployadas:

| Teste | Função | Payload | O que valida |
|---|---|---|---|
| 1 | `kojak-code` | prompt curto sem history | Tom Gemini (resposta curta/direta) |
| 2 | `kojak-code` | prompt + history de 3 mensagens | Memória conversacional |
| 3 | `kojak-code` | "crie um curso de Python" | Guardrail de segurança (deve recusar) |
| 4 | `kojak-vision` | só `prompt` | Geração one-shot por texto |
| 5 | `kojak-vision` | `prompt` + `image` | Edição de imagem |
| 6 | `kojak-vision` | `prompt` + `image` + `reference_image` | Face swap / composição |

### Etapa 3 — Análise de logs e correções pontuais

- Ler logs de cada função após os testes (`supabase--edge_function_logs`)
- Se algum cenário falhar, aplicar correção cirúrgica no `index.ts` da função afetada e redeployar
- Confirmar que CORS, parsing de payload e respostas JSON estão íntegros

### Etapa 4 — Relatório final

Entregar um resumo objetivo com:
- ✅ / ❌ para cada um dos 6 testes
- Latência aproximada de cada modo
- Qualquer ajuste aplicado
- Próximos passos (ex.: configurar `REPLICATE_API_TOKEN` se o usuário quiser ativar o Motion de fato)

### Detalhes técnicos

- **Não** vou alterar `src/integrations/supabase/client.ts` nem `types.ts`
- A migration do storage usa apenas `storage.buckets` e `storage.objects` (não toca em schemas reservados além do permitido para policies de bucket)
- O deploy é automático após a migration; o usuário não precisa fazer nada manual
- O teste de face swap usa duas URLs públicas pequenas (ex.: avatares do unsplash) para não depender de upload prévio do usuário

### O que o usuário verá

Um relatório claro tipo:
```text
[OK]  kojak-code   tom Gemini      342ms
[OK]  kojak-code   memória         410ms
[OK]  kojak-code   guardrail curso 280ms
[OK]  kojak-vision texto puro      8.2s
[OK]  kojak-vision edição          9.1s
[OK]  kojak-vision face swap       11.4s
```

Pronto para aprovar e executar.

