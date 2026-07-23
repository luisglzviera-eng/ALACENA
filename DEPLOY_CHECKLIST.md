# Checklist de producción — Alacena 3.0

- [ ] Ejecuté `supabase/schema.sql` completo sin errores.
- [ ] Creé exactamente dos cuentas y desactivé el registro público.
- [ ] Configuré Supabase URL, anon key y service role en Netlify.
- [ ] Generé un par de llaves VAPID.
- [ ] Configuré la llave pública con prefijo `VITE_` y la privada sin ese prefijo.
- [ ] Configuré `VAPID_SUBJECT` con un correo válido.
- [ ] Configuré `PUSH_ADMIN_SECRET` con una cadena larga y aleatoria.
- [ ] Configuré OpenAI para las funciones de IA.
- [ ] Netlify terminó el build sin errores.
- [ ] Verifiqué que `check-notifications` aparece como Scheduled Function.
- [ ] Probé login y Realtime en ambos teléfonos.
- [ ] Instalé Alacena en la pantalla de inicio de ambos iPhone.
- [ ] Activé notificaciones desde Preferencias en cada dispositivo.
- [ ] Envié una prueba usando `send-push`.
- [ ] Probé caducidades, menú, presupuesto y compras recurrentes.
- [ ] Confirmé que una misma alerta no se repite durante el día.
