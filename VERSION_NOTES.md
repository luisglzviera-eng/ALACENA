# Alacena 5.0 — Enrutamiento inteligente de IA

- Sustituye la configuración de un solo modelo por dos niveles.
- `gpt-4.1-mini` atiende las tareas cotidianas y económicas.
- `gpt-5` se reserva para análisis complejos.
- La selección ocurre en el servidor y no requiere que el usuario elija.
- Se mantiene compatibilidad con la variable anterior `OPENAI_MODEL`.
- Las respuestas incluyen metadatos internos `_ai` para diagnóstico de modelo, nivel y tarea.
- No se realizan llamadas de IA en segundo plano.
