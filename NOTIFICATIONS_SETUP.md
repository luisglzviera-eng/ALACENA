# Configuración de notificaciones push — Alacena 3.0

## 1. Crear las llaves VAPID

Después de instalar dependencias, ejecuta desde la carpeta del proyecto:

```bash
npx web-push generate-vapid-keys
```

Copia la llave pública en `VITE_VAPID_PUBLIC_KEY` y la privada en `VAPID_PRIVATE_KEY`.

## 2. Variables de Netlify

Configura:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_ADMIN_SECRET`

La `SUPABASE_SERVICE_ROLE_KEY` y la llave VAPID privada nunca deben estar en variables que empiecen con `VITE_`.

## 3. Base de datos

Ejecuta `supabase/schema.sql` completo en el SQL Editor. Es idempotente: puede ejecutarse sobre una instalación anterior.

## 4. Programación

`netlify.toml` ejecuta `check-notifications` cada hora. La función usa la zona `America/Mexico_City` y respeta las horas elegidas en cada dispositivo.

## 5. Activación en iPhone

1. Abrir el sitio desplegado en Safari.
2. Compartir → Agregar a pantalla de inicio.
3. Abrir Alacena desde el icono instalado.
4. Iniciar sesión.
5. Ajustes → Activar notificaciones.
6. Aceptar el permiso de iOS.

## 6. Prueba manual

Puedes llamar a `/.netlify/functions/send-push` con POST y los encabezados:

- `Content-Type: application/json`
- `x-alacena-secret: valor_de_PUSH_ADMIN_SECRET`

Cuerpo:

```json
{
  "title": "Prueba de Alacena",
  "body": "Las notificaciones están funcionando.",
  "url": "/inicio"
}
```

## Reglas incluidas

- Productos por vencer.
- Menú del día.
- Lista pendiente para el día siguiente.
- Presupuesto mensual.
- Compras recurrentes.
- Horario silencioso.
- Máximo diario por dispositivo.
- Deduplicación por regla y fecha.
