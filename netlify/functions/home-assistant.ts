import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  try {
    const body = JSON.parse(event.body || '{}');
    const base = `Eres Alacena, un asistente doméstico para familias en México. Responde siempre en español de México y únicamente como JSON válido. Sé concreto y práctico. Considera preferencias: ${JSON.stringify(body.preferences || {})}. Despensa: ${JSON.stringify(body.pantry || [])}. Sobrantes: ${JSON.stringify(body.leftovers || [])}. Recetas guardadas: ${JSON.stringify(body.recipes || [])}. Comidas recientes: ${JSON.stringify(body.recentMeals || [])}. No inventes que un producto está disponible si no aparece en la despensa.`;

    let prompt = base;
    if (body.mode === 'shopping') {
      prompt += ` La persona pide: ${String(body.customPrompt || 'Crea una lista semanal del súper')}. Genera una lista de compra completa y práctica, agrupable por pasillos. Excluye lo que ya existe en cantidad suficiente en la despensa. Devuelve exactamente {"answer":"resumen breve","items":[{"name":"producto","category":"Frutas y verduras|Carnes y pescado|Lácteos y huevos|Despensa|Limpieza y hogar|Otros","quantity":1,"unit":"pza|kg|g|L|ml|paquete","why":"motivo breve"}]}. Incluye entre 8 y 25 productos según la solicitud.`;
    } else if (body.mode === 'cook') {
      prompt += ` La persona pide: ${String(body.customPrompt || '¿Qué puedo cocinar hoy?')}. Sugiere 5 recetas realizables y familiares. Devuelve {"answer":"resumen breve","suggestions":[{"name":"receta","why":"explicación breve","ingredients":["ingrediente con cantidad"]}]}.`;
    } else if (body.mode === 'leftovers') {
      prompt += ' Sugiere 5 formas seguras de aprovechar sobrantes. Devuelve {"answer":"resumen breve","suggestions":[{"name":"idea","why":"explicación breve","ingredients":["ingrediente adicional opcional"]}]}. Mantén refrigeración y seguridad alimentaria.';
    } else if (body.mode === 'fridge') {
      prompt += ' Observa la foto, identifica solo alimentos visibles con confianza y sugiere 4 comidas. Devuelve {"answer":"resumen breve","detected":[{"name":"alimento detectado","why":"visible en la imagen"}],"suggestions":[{"name":"receta","why":"explicación","ingredients":["ingrediente"]}]}.';
    } else if (body.mode === 'expiring') {
      prompt += ` La persona pregunta: ${String(body.customPrompt || '¿Qué está por vencer?')}. Revisa las fechas proporcionadas y devuelve {"answer":"respuesta concreta","suggestions":[{"name":"producto o acción","why":"fecha y recomendación"}]}.`;
    } else {
      prompt += ` La persona pregunta: ${String(body.customPrompt || 'Ayúdame a organizar mi cocina')}. Responde directamente y devuelve {"answer":"respuesta breve","suggestions":[{"name":"acción o idea","why":"explicación breve"}]}. Incluye entre 3 y 6 sugerencias útiles.`;
    }

    const content: any[] = [{ type: 'text', text: prompt }];
    if (body.imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 } });

    const task = body.mode === 'optimize' ? 'household_optimization' : body.mode === 'fridge' ? 'fridge_analysis' : body.mode === 'leftovers' ? 'leftovers' : 'recipe_suggestions';
    const result = await callOpenAI(content, { task, maxOutputTokens: 2200, timeoutMs: 26000 });
    return json(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[home-assistant] Error final', { message });
    return json(500, { error: message });
  }
};
