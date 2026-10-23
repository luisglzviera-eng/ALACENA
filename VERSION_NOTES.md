# v8.13.1 — Agregar / quitar en el catálogo
- Botón "Agregar / quitar" en Mi catálogo: formulario para agregar un producto nuevo a la sección que elijas y ✕ para quitar productos.

# v8.13.0 — Menús quincenales + catálogo del súper
- Menú: pestañas "Esta semana" / "Siguiente semana" (quincena). La IA arma la siguiente sin repetir platillos. "Lista de la quincena" junta las dos semanas.
- La fecha del menú ahora muestra el rango (del 19 al 25 de octubre). Si el menú es de una semana vieja avisa y ofrece pasar la siguiente o empezar una nueva (la nueva empieza el lunes de esa semana).
- Compras: "Mi catálogo" con la lista de súper de Excel (15 secciones, ~190 productos). Tocar un producto lo agrega; marca lo que ya está en la lista o en la despensa; se puede buscar y editar.
- SQL opcional para guardar cambios propios del catálogo: supabase/update_v8_13_catalogo.sql (sin SQL el catálogo base funciona igual).

# v8.12.2 — Compras en español
- En la lista, el origen del producto se ve en español (despensa, menú, IA, receta…) en vez de pantry/menu/ai.

# v8.12.1 — Logo nuevo
- Logo "casa con repisas" en el encabezado, la pantalla de entrada y el ícono de la app (incluye ícono para iPhone).
- Si en el celular sigue el ícono viejo: quita la app de la pantalla de inicio y vuelve a agregarla.

# v8.12.0 — Carga inicial de la despensa con fotos
- Despensa → botón "Fotos": eliges hasta 8 fotos (refri por repisa, congelador, alacena); la IA lista lo que ve.
- Revisas nombre, cantidad, unidad y categoría; lo estimado sale en amarillo para confirmar.
- Lo repetido entre fotos se junta; lo que ya tienes viene desmarcado. Las cantidades de fotos son estimaciones. No requiere SQL.

# v8.11.0 — Cerrar el día (descuento del inventario)
- Tarjeta en Inicio: confirma lo que sí cocinaron hoy; resta de la despensa los ingredientes de las recetas (convierte g↔kg, ml↔L, sin pasarse de lo que hay).
- Lo que no puede calcular (unidades distintas, sin receta guardada) se avisa y no se toca solo.
- Básicos de consumo libre (leche, huevos, pan…): conteo rápido con + y −.
- El día queda cerrado para los dos celulares (no se descuenta dos veces). No requiere SQL.

# v8.10.4 — Piezas vs. contenido
- Envases individuales (yogurt 70 g, leche 1 L): la despensa guarda las piezas (4 pza) y la presentación queda en el nombre.
- Paquetes con varias piezas adentro (huevo 30 PZ): se multiplica (30 pza).
- No requiere SQL.

# v8.10.3 — La IA calcula lo que entra a la despensa
- Lee el contenido del paquete de la descripción (HUEVO 30 PZ = 30 piezas, 5 × LECHE 1 LT = 5 L, 4 × 70 gr = 280 g).
- Si el ticket no dice cuánto trae (pechuga), te lo marca para confirmar antes de guardar.
- Fecha de HEB (MM-DD-AA) y renglones de donativo/IEPS ignorados.
- No requiere SQL.

# v8.10.2 — Cantidad y unidad por producto en tickets
- Cada renglón del ticket tiene cantidad + unidad (pza, kg, g, L…); la IA lee el peso del ticket (carnes, frutas, verduras).
- La despensa recibe la cantidad real (ej. 0.8 kg de pechuga) y aviso si algo por peso quedó en piezas.
- No requiere SQL.

# v8.10.1 — Tickets de Costco, Sam's y Calii
- Tiendas: HEB, Costco, Sam's, Calii, Otro (se quitó Calimax).
- El lector separa lo que no es comida (limpieza, papel, higiene, bebé, mascotas, hogar, etc.): no se suma a la despensa y puedes cambiarlo renglón por renglón.
- Reportes: nuevo bloque "Comida y otros productos".
- No requiere SQL.

# v8.10.0 — Tickets y reportes de gasto
- Lector de tickets HEB/Calii/Calimax (foto o captura): productos, cantidades, precios, fecha y tienda; revisión editable.
- Avisos: total que no cuadra, ticket duplicado; guardado con errores claros y sin tickets a medias.
- Sumar a la despensa sin duplicar; borrar tickets; foto reducida antes de enviar.
- Reportes: por mes, tienda, categoría, productos donde más se gasta y contra presupuesto.
- No requiere SQL.

# v8.9.1 — Mi familia
- Ajustes > Mi familia: 2 adultos, niña y bebé (editable) con notas de cada quien.
- El menú con IA usa la familia (ya no hay selector de personas); el bebé no cuenta en cantidades.
- Requiere correr supabase/update_v8_9_familia.sql una vez.

# v8.9.0 — Menú con más comidas
- Cada día ahora tiene Desayuno, Comida, Snack, Lunch de la niña y Cena.
- "Armar semana con IA" deja elegir qué comidas incluir.
- No requiere SQL ni cambios en Netlify.

# ALACENA 8.8.0 — Sprint 4: Menú semanal funcional

- Escribir una comida ya NO guarda por cada letra: se guarda al salir del campo (o Enter). Antes la pantalla podía perder letras y saturaba Supabase. Dos comidas seguidas no se pisan.
- Botón 📖 en cada comida: elige entre tus recetas guardadas (con buscador) o pide "Ideas con IA" y toca una para ponerla. Ya no se muestran ideas inventadas cuando falla la IA: se muestra el error con reintento.
- "Armar semana con IA": menú de 7 días (comida y cena) que respeta las dietas de Ajustes, usa tus recetas, aprovecha lo que va a caducar y la despensa. Vista previa y tú decides: "Aplicar solo a los vacíos" (no toca lo que ya escribiste), "Reemplazar todo" o "Descartar".
- "Lista de compras del menú": junta los ingredientes de las recetas guardadas (suma lo repetido, ej. 2+2 jitomates), quita lo que ya tienes en la despensa, calcula con IA los platillos que no son receta guardada, marca "Ya está en Compras" y te deja elegir/editar cantidades antes de agregar.
- Archivar pide confirmación y crea la semana nueva; en el historial, "Usar de nuevo" copia un menú anterior a la semana actual.
- Errores reales de Supabase en pantalla (sin perder lo escrito).
- Nueva función Netlify: generate-menu. No cambia el esquema de Supabase ni las variables.

# ALACENA 8.7.0 — Sprint 3: Despensa funcional

- Botones − / + en cada producto para ajustar la cantidad (paso según unidad: 1 pza, 0.5 kg/L, 100 g/ml). Se guarda al instante.
- Editar producto: nombre, categoría (se sugiere sola), cantidad, unidad, caducidad, "avisar cuando quede X o menos" y código de barras.
- Si agregas algo que ya tienes (mismo nombre y unidad) se SUMA la cantidad, no se duplica.
- Resumen tocable: Productos / Por caducar / Stock bajo. Buscador. Orden: caducados, por caducar, stock bajo, resto.
- Etiquetas claras: "Caducó hace N días", "Caduca mañana", "Stock bajo", "Agotado".
- "Agregar faltantes a Compras": manda a Compras lo que está bajo o agotado (cantidad sugerida), sin repetir lo que ya está en la lista. También por producto, y al llegar a 0 se ofrece automáticamente.
- "Lista inteligente" de Compras ahora interpreta cantidad/unidad de las recetas del menú y no pide lo que ya tienes en la despensa.
- Errores reales de Supabase (guardar, borrar) en pantalla; el formulario no se pierde si falla; quitar pide confirmación.
- Corregido: guardar un cambio parcial ya no borra la caducidad.
- No cambia el esquema de Supabase ni variables.

# ALACENA 8.6.0 — Fotos de recetas con IA

- Al guardar una receta generada con IA se crea automáticamente su foto (quesadillas = foto de quesadillas, sándwich = foto de sándwich). Mientras carga o si falla, se queda la ilustración.
- En cada receta guardada hay botón "Generar foto" / "Nueva foto" (sirve para recetas hechas a mano o anteriores).
- La foto se reduce y se guarda en Supabase Storage (bucket recipe-photos); queda ligada a la receta.
- Errores claros: falta el SQL, organización de OpenAI sin verificar, llave inválida, tiempo agotado.
- Nueva función Netlify: generate-recipe-photo (modelo OPENAI_MODEL_IMAGE, por defecto gpt-image-1-mini con respaldo gpt-image-1).
- IMPORTANTE: ejecutar una vez supabase/update_v8_6_fotos.sql en Supabase → SQL Editor.
- Costo: unos centavos de dólar por foto en tu cuenta de OpenAI.

# ALACENA 8.5.0 — Sprint 2: Recetas con IA

- Recetario → "Crear con IA": pide recetas con texto libre o con un toque (Para niños, Snacks, Económicas, Con mi despensa, Cena familiar).
- Cada receta respeta la dieta de ti y de tu esposa (las de Ajustes), trae tiempo, porciones, pasos cortos, ingredientes con cantidad/unidad y costo ESTIMADO (rotulado como estimación, nunca precio real).
- "Guardar receta" guarda de verdad en Supabase y confirma; si falla muestra el error.
- "Ingredientes a Compras": lista con selección y cantidades editables; marca "Ya está en Compras" y "Ya tienes en despensa"; no repite productos. Funciona igual desde recetas guardadas.
- Ya no se agrega "500 g pechuga" como 1 pieza de Despensa: ahora se interpreta cantidad, unidad y categoría.
- Eliminar receta pide confirmación y muestra errores reales.
- Se reemplazó la tarjeta decorativa fija "Pasta cremosa de despensa" por el generador.
- Nueva función Netlify: generate-recipes. No cambia el esquema de Supabase ni las variables.

# ALACENA 8.4.1 — correcciones de uso en iPhone

- Cantidad editable: campo de texto con botones − / + (ya no se atora al borrar o escribir).
- Compras: nuevo botón "Vaciar lista" (con confirmación) y "Quitar marcados" / borrar uno ahora actualizan la pantalla al instante.
- Si Supabase rechaza un borrado, se muestra el error en lugar de fallar en silencio.

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
