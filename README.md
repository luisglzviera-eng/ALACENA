# Alacena 3.0

Aplicación privada para una pareja: lista del súper, menú semanal, recetario, tickets con IA, reportes, despensa inteligente, presupuesto y notificaciones push.

## Incluye

- React + Vite + TypeScript + Tailwind CSS 4.
- Supabase Auth, Postgres, Storage, RLS y Realtime.
- Netlify Functions para OpenAI.
- PWA instalable en iPhone, Android y escritorio.
- Web Push real en segundo plano.
- Modo demostración sin credenciales.

## Despliegue

### 1. GitHub

Crea un repositorio vacío y sube **el contenido de esta carpeta**.

### 2. Supabase

1. Crea el proyecto.
2. Ejecuta `supabase/schema.sql` completo en SQL Editor.
3. Copia Project URL, anon/publishable key y service role key.
4. Crea las dos cuentas.
5. Después desactiva el registro público.

### 3. Llaves VAPID

En una terminal dentro del proyecto:

```bash
npm install
npx web-push generate-vapid-keys
```

Conserva ambas llaves. La privada nunca debe llegar al frontend.

### 4. Netlify

Conecta el repositorio. `netlify.toml` configura:

- Build: `npm run build`
- Publish: `dist`
- Functions: `netlify/functions`
- Revisión de notificaciones: cada hora

Agrega estas variables:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_publica
VITE_VAPID_PUBLIC_KEY=tu_llave_vapid_publica
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
OPENAI_API_KEY=tu_clave_de_openai
OPENAI_MODEL_FAST=gpt-4.1-mini
OPENAI_MODEL_ADVANCED=gpt-5
VAPID_PRIVATE_KEY=tu_llave_vapid_privada
VAPID_SUBJECT=mailto:tu-correo@dominio.com
PUSH_ADMIN_SECRET=una_cadena_larga_aleatoria
```

Las variables `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY` y `PUSH_ADMIN_SECRET` deben tener alcance exclusivo de Functions/servidor.

### 5. Activar push en iPhone

1. Abrir Alacena desplegada en Safari.
2. Compartir → Agregar a pantalla de inicio.
3. Abrirla desde el icono instalado.
4. Iniciar sesión.
5. Preferencias → Activar notificaciones.
6. Aceptar el permiso de iOS.

Consulta `NOTIFICATIONS_SETUP.md` para pruebas y detalles.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run netlify:dev
```

## Seguridad

- RLS activo en tablas de usuario.
- Cada persona solo administra sus suscripciones push.
- El servidor usa service role solo dentro de Netlify Functions.
- El bucket de tickets es privado.
- Las llaves privadas no usan prefijo `VITE_`.

## Notificaciones incluidas

- Productos próximos a vencer.
- Menú del día.
- Artículos pendientes para mañana.
- Uso del presupuesto mensual.
- Compras recurrentes.
- Horario silencioso.
- Límite diario y deduplicación.
