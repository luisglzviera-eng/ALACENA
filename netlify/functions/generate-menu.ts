import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';
import { friendlyAIError } from './_shared/errors';
import { normalizeMenuResponse } from '../../src/lib/shopping';

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const body = JSON.parse(event.body || '{}');
    const request = String(body.prompt || '').trim().slice(0, 300);
    const people = Math.min(20, Math.max(1, Math.round(Number(body.people)) || 4));
    const prefs = body.preferences || {};
    const names = (list: unknown, max: number) => (Array.isArray(list) ? list : []).slice(0, max).map((x: any) => String(x?.name ?? x).slice(0, 50)).filter(Boolean);
    const saved = names(body.savedRecipes, 40);
    const pantry = names(body.pantry, 50);
    const expiring = names(body.expiring, 15);
    const keep = (Array.isArray(body.keep) ? body.keep : []).slice(0, 14).map((x: unknown) => String(x).slice(0, 60)).filter(Boolean);

    const prompt = [
      'Eres Alacena, asistente culinario de una familia en México. Responde SOLO con JSON válido, en español de México.',
      'Forma exacta: {"answer":"frase corta","days":{"Lunes":{"lunch":"platillo","dinner":"platillo"},"Martes":{...},"Miércoles":{...},"Jueves":{...},"Viernes":{...},"Sábado":{...},"Domingo":{...}}}',
      `Arma el menú de una semana (comida y cena, 7 días) para ${people} personas. Cada platillo es solo el NOMBRE (máximo 6 palabras), sin descripción.`,
      request ? `Pedido de la persona: ${request}` : '',
      `Dieta persona 1: ${prefs.diet_user || 'sin restricciones indicadas'}. Dieta persona 2: ${prefs.diet_partner || 'sin restricciones indicadas'}. TODOS los platillos deben respetar AMBAS dietas.`,
      prefs.kids_recipes ? 'Hay niños: incluye varias opciones sencillas y poco picantes que les gusten.' : '',
      prefs.budget_priority ? 'Prioriza ingredientes económicos y de temporada; evita cortes caros.' : '',
      'Ingredientes que se consigan en HEB, Calimax o Calii. Varía proteínas y evita repetir platillos. Entre semana prefiere cosas rápidas.',
      saved.length ? `Usa recetas ya guardadas cuando encajen (nombre exacto): ${saved.join(', ')}.` : '',
      expiring.length ? `Aprovecha primero lo que va a caducar: ${expiring.join(', ')}.` : '',
      pantry.length ? `En la despensa hay: ${pantry.join(', ')}.` : '',
      keep.length ? `Ya están decididos y NO debes cambiarlos ni repetirlos: ${keep.join(', ')}.` : '',
    ].filter(Boolean).join('\n');

    const data = await callOpenAI([{ type: 'text', text: prompt }], { task: 'recipe_suggestions', maxOutputTokens: 1400, timeoutMs: 26000 });
    const plan = normalizeMenuResponse(data);
    if (plan.filled < 4) return json(502, { error: 'La IA no devolvió un menú completo. Intenta de nuevo.' });
    return json(200, plan);
  } catch (error) {
    const message = friendlyAIError(error instanceof Error ? error.message : 'Error inesperado');
    console.error('[generate-menu] Error', { message });
    return json(500, { error: message });
  }
};
