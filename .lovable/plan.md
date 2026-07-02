# Plano de Auditoria & Ajustes — Kojak IA

Vou executar 3 frentes em paralelo, depois validar ponta a ponta.

## 1. Backend / Edge Functions (Gemini via OpenRouter)

Estado atual verificado no contexto: as 3 funções (`kojak-code`, `kojak-saude`, `kojak-vision`) chamam `openrouter.ai/api/v1/chat/completions` com `google/gemini-2.5-flash` usando `OPENROUTER_API_KEY` — que já está em secrets. Integração OK.

Ajustes:
- **Upgrade de modelo**: trocar `google/gemini-2.5-flash` por `google/gemini-3-flash-preview` (default 2026 do gateway) nas 3 funções, mantendo fallback.
- **Validação de payload**: confirmar que `history`, `context`, `image`, `reference_image` continuam sendo aceitos (já estão).
- **Kojak Motion**: a função atual (`kojak-saude`) foi mapeada como "Saúde". Confirmar se o modo Motion (vídeo Replicate) segue com `REPLICATE_API_TOKEN` já configurado — só validar, não alterar.
- **Sem mudança de secrets**: `OPENROUTER_API_KEY` e `REPLICATE_API_TOKEN` já existem.

## 2. Persona da IA — Tom conversacional (anti-text