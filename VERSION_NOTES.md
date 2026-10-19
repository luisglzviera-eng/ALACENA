# ALACENA 8.4 — Sprint 1: Lista inteligente funcional

Qué hace ahora:
- Escribes "Haz una lista de compras para HEB para cuatro personas durante siete días con un presupuesto de $2,500" y la IA devuelve productos con nombre, cantidad, unidad y categoría.
- Puedes seleccionar / quitar productos, "Seleccionar todos" y editar cantidad y unidad antes de guardar.
- "Agregar seleccionados a Compras" guarda de verdad en Supabase (tabla grocery_items) y confirma cuántos se agregaron.
- Detecta duplicados (ignora acentos, mayúsculas y plurales): los marca "Ya está en Compras" y no los vuelve a insertar.
- Si falla Supabase, OpenAI o el internet, muestra el error real con botón de reintento (antes decía "agregado" aunque no se hubiera guardado).
- Los precios son ESTIMADOS por la IA y se rotulan así; nunca se presentan como precios reales de HEB. El total estimado se compara contra tu presupuesto.
- Arreglado: el botón "Ver Compras" mandaba a una ruta inexistente (/grocery); ahora va a /lista.
- Compras se actualiza al instante y la actualización en tiempo real ya no satura la app.

Archivos nuevos: src/lib/shopping.ts, src/components/SmartShoppingList.tsx, src/smart-list.css.
Archivos modificados: netlify/functions/home-assistant.ts, src/context/AppContext.tsx, src/pages/Assistant.tsx, src/main.tsx.
No cambia el esquema de Supabase ni las variables de entorno.

Cómo comprobarlo (2 minutos, ya publicado):
1. Asistente → escribe la frase de arriba (o toca un ejemplo).
2. Quita "Seleccionar todos", marca 3 productos, cambia una cantidad.
3. Toca "Agregar seleccionados a Compras (3)" → debe decir "Se agregaron 3 productos".
4. Recarga la app → entra a Compras → los 3 siguen ahí.

# ALACENA 8.3

- Resultados de IA seleccionables.
- Botón Agregar seleccionados.
- Botón individual para agregar cada producto.
- Detección automática de solicitudes de supermercado y recetas.
- Listas para HEB, Costco y otros comercios con categoría, cantidad y unidad.
- Confirmación y acceso directo a Compras después de agregar resultados.
