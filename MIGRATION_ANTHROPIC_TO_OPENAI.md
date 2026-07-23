# Migración de Anthropic a OpenAI

Esta versión elimina completamente Anthropic.

## Cambios realizados

- Nuevo cliente compartido: `netlify/functions/_shared/openai.ts`.
- Las funciones `parse-receipt`, `parse-diet`, `suggest-recipes` y `home-assistant` usan OpenAI Responses API.
- Eliminado `_shared/anthropic.ts`.
- Variables reemplazadas:
  - `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`
  - `ANTHROPIC_MODEL` → `OPENAI_MODEL`
- Modelo predeterminado económico: `gpt-4.1-mini`.
- La IA continúa ejecutándose solo al pulsar botones dentro de la app.

## Netlify

Elimina las variables antiguas de Anthropic y agrega:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```
