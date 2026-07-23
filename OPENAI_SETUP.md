# OpenAI en Alacena 5.0

Alacena selecciona el modelo automáticamente según la tarea.

## Variables de Netlify

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL_FAST=gpt-4.1-mini
OPENAI_MODEL_ADVANCED=gpt-5
```

## Política de uso

### Modelo rápido/económico
Se usa para:
- lectura de tickets;
- recetas y menús;
- fotos del refrigerador;
- aprovechamiento de sobrantes;
- consultas cotidianas.

### Modelo avanzado
Se usa únicamente para:
- análisis de planes alimenticios con múltiples restricciones;
- optimización integral del hogar, gasto, nutrición y desperdicio.

La IA solo se invoca cuando una persona pulsa una acción de IA. Las notificaciones, sincronización, reportes normales y tareas programadas no consumen OpenAI.

## Compatibilidad

`OPENAI_MODEL` sigue aceptándose como respaldo para instalaciones anteriores, pero se recomienda reemplazarlo por las dos variables anteriores.
