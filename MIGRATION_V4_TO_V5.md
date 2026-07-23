# Migración de Alacena 4.0 a 5.0

En Netlify elimina o conserva temporalmente:

```env
OPENAI_MODEL=gpt-4.1-mini
```

Agrega:

```env
OPENAI_MODEL_FAST=gpt-4.1-mini
OPENAI_MODEL_ADVANCED=gpt-5
```

No se requieren cambios en Supabase ni volver a ejecutar `schema.sql`.
Después de guardar las variables, ejecuta un nuevo deploy en Netlify.
