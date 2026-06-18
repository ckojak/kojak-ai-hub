
# Plano: Kojak IA 2026 — Upgrade Completo

O Cloud esta pausado. Vou reativa-lo e depois atualizar toda a stack para o padrao 2026 com streaming, multimodal, voz profissional e modelo mais recente.

---

## Etapa 1 — Reativar Cloud e confirmar saude

- Chamar `supabase--restart` para reativar o backend
- Confirmar `ACTIVE_HEALTHY` antes de prosseguir
- Verificar que `LOVABLE_API_KEY` existe

## Etapa 2 — Atualizar Edge Functions para 2026

### kojak-code (Chat principal)
- Modelo: `google/gemini-2.5-flash` -> `google/gemini-3-flash-preview`
- **Streaming**: migrar de resposta JSON unica para AI SDK `streamText` + `toUIMessageStreamResponse`
- Usar `npm:ai` e `npm:@ai-sdk/openai-compatible` com o helper `createLovableAiGatewayProvider`
- Manter system prompt, memoria conversacional e guardrail de cursos

### kojak-saude
- Mesmo upgrade: modelo `gemini-3-flash-preview` + streaming

### kojak-vision
- Modelo ja usa `gemini-3-pro-image-preview` (OK)
- Manter sem streaming (retorna imagem, nao texto)

### kojak-motion
- Manter como esta (depende de Replicate)

### Nova: kojak-tts (Text-to-Speech)
- Edge Function que chama `POST /v1/audio/speech` com `openai/gpt-4o-mini-tts`
- SSE streaming com `response_format: "pcm"` para playback em tempo real
- Substitui o `speechSynthesis` do navegador (voz robotica) por voz profissional

### Nova: kojak-stt (Speech-to-Text)
- Edge Function que chama `POST /v1/audio/transcriptions` com `openai/gpt-4o-mini-transcribe`
- Recebe audio gravado pelo usuario e retorna transcricao

## Etapa 3 — Frontend: UX estilo Gemini (Dark Futurism)

### Streaming no Chat
- Instalar `@ai-sdk/react` e `ai` no frontend
- Ou: consumir SSE manualmente no `handleSendMessage` para mostrar tokens chegando em tempo real
- Efeito de digitacao natural enquanto a resposta chega

### Upload Multimodal
- Expandir `ChatInput` para aceitar **PDF** e **audio** alem de imagens
- Enviar arquivos como base64 ou upload ao Storage e passar URL para a Edge Function
- PDFs: parsear no servidor e enviar texto ao modelo
- Audio: enviar para `kojak-stt` e transcrever antes de enviar ao chat

### Voz Profissional
- Botao "Ouvir" nas mensagens do assistente agora chama `kojak-tts` (voz natural)
- Botao de microfone grava audio WebM/MP4, envia para `kojak-stt`, recebe transcricao
- Playback via Web Audio API com PCM streaming

### Layout Gemini-like (mantendo Dark Futurism)
- Empty state: logo Kojak maior, sugestoes em cards com icones (estilo chips do Gemini)
- Mensagens do assistente: **sem background** (texto direto na superficie, como Gemini)
- Mensagens do usuario: bolha preenchida com gradiente roxo (manter)
- Input: campo centralizado com cantos arredondados, botoes de anexo e mic integrados
- Animacao de "pensando" com shimmer/skeleton em vez do typing indicator atual
- Auto-scroll suave

## Etapa 4 — Deploy e Validacao

- Deploy de todas as Edge Functions atualizadas
- Testar streaming no chat (enviar mensagem, ver tokens fluindo)
- Testar upload de imagem no Vision
- Testar voz: gravar -> transcrever -> enviar -> ouvir resposta
- Testar modo Saude com streaming

---

## Detalhes Tecnicos

| Componente | Antes | Depois |
|---|---|---|
| Modelo chat | gemini-2.5-flash | gemini-3-flash-preview |
| Resposta chat | JSON completo | SSE streaming token-a-token |
| TTS | Web Speech API (navegador) | Lovable AI gpt-4o-mini-tts (voz natural) |
| STT | Web Speech API (navegador) | Lovable AI gpt-4o-mini-transcribe |
| Upload | Apenas imagens | Imagens + PDF + Audio |
| AI SDK | Nenhum | npm:ai + @ai-sdk/openai-compatible |
| Mensagem assistente | Bolha glass | Sem background (estilo Gemini) |
| Loading | TypingIndicator dots | Shimmer/skeleton animado |
