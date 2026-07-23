# Alacena 5.1

Corrección de compilación para Vite y TypeScript.

- Se agregó `src/vite-env.d.ts` con los tipos de `import.meta.env`.
- Se conserva la configuración de OpenAI, Supabase, PWA y notificaciones push.
- No contiene claves privadas ni archivos `.env` reales.

Para Netlify:
- Base directory: vacío
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
