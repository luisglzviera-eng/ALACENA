import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';
import { friendlyAIError } from './_shared/errors';
import { normalizeRecipesResponse } from '../../src/lib/shopping';

const MODES: Record<string, string> = {
  general: 'comidas o cenas familiares',
  kids: 'recetas PARA NIÑOS: rápidas (máximo 25 minutos), sabores sencillos, poco picante, fáciles de comer',
  snack: 'ideas de SNACKS o colaciones rápidas y saludables, de 5 a 15 minutos',
  budget: 'recetas MUY ECONÓMICAS y rendidoras, con ingredientes baratos y de temporada',
  pantry: 'recetas que aprovechen principalmente lo que ya hay en la despensa',
};

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const body = JSON.parse(event.body || '{}');
    const mode = typeof body.mode === 'string' && MODES[body.mode] ? body.mode : 'general';
    const request = String(body.prompt || '').trim().slice(0, 400);
    const count = Math.min(4, Math.max(1, Math.round(Number(body.count)) || 3));
    const prefs = body.preferences || {};
    const pantry = (Array.isArray(body.pantry) ? body.pantry : []).slice(0, 60).map((p: any) => String(p?.name ?? p).slice(0, 40)).filter(Boolean);
    const saved = (Array.isArray(body.savedRecipes) ? body.savedRecipes : []).slice(0, 30).map((r: any) => String(r?.name ?? r).slice(0, 60)).filter(Boolean);

    const prompt = [
      'Eres Alacena, asistente culinario de una familia en México. Responde SOLO con JSON válido, en español de México.',
      `Forma exacta: {"answer":"frase corta","recipes":[{"name":"","why":"","servings":4,"prep_minutes":25,"estimated_cost":180,"tags":["niños"],"fits":"","ingredients":[{"name":"","quantity":1,"unit":"kg","category":"Despensa"}],"steps":["",""]}]}`,
      `Genera exactamente ${count} ${MODES[mode]}.`,
      request ? `Pedido de la persona: ${request}` : '',
      `Dieta persona 1: ${prefs.diet_user || 'sin restricciones indicadas'}. Dieta persona 2: ${prefs.diet_partner || 'sin restricciones indicadas'}. CADA receta debe respetar AMBAS dietas; en "fits" explica en una frase cómo cumple con cada una.`,
      prefs.budget_priority ? 'Prioriza ingredientes económicos y de temporada; evita cortes caros y productos gourmet.' : '',
      'Usa ingredientes que se consigan en HEB, Costco, Sam’s o Calii. Cada ingrediente lleva cantidad y unidad (pza, kg, g, L, ml, paquete, lata, bolsa, caja, docena) y categoría (Frutas y verduras, Carnes y pescado, Lácteos y huevos, Despensa, Limpieza y hogar, Otros).',
      '"estimated_cost" es el costo total aproximado en pesos MXN: es una estimación, no un precio real.',
      'Pasos cortos: máximo 6 pasos de una oración cada uno. No repitas recetas ya guardadas.',
      pantry.length ? `En la despensa hay: ${pantry.join(', ')}.` : '',
      saved.length ? `Recetas ya guardadas: ${saved.join(', ')}.` : '',
    ].filter(Boolean).join('\n');

    const data = await callOpenAI([{ type: 'text', text: prompt }], { task: 'recipe_suggestions', maxOutputTokens: 3000, timeoutMs: 26000 });
    const plan = normalizeRecipesResponse(data);
    if (!plan.recipes.length) return json(502, { error: 'La IA no devolvió recetas completas. Intenta de nuevo o cambia un poco el pedido.' });
    return json(200, { ...plan, mode, estimates: true });
  } catch (error) {
    const message = friendlyAIError(error instanceof Error ? error.message : 'Error inesperado');
    console.error('[generate-recipes] Error', { message });
    return json(500, { error: message });
  }
};
