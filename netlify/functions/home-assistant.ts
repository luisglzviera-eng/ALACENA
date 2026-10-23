import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';
import { normalizeShoppingResponse, parseShoppingRequest, type Household } from '../../src/lib/shopping';

/** Convierte errores técnicos de OpenAI en mensajes claros y nunca deja pasar fragmentos de la llave. */
function friendlyAIError(raw: string): string {
  const message = raw.replace(/sk-[A-Za-z0-9_-]+/g, '[llave oculta]');
  if (/api key|invalid_api_key|incorrect api key|unauthorized|401/i.test(message)) {
    return 'OpenAI rechazó la llave. Revisa que OPENAI_API_KEY en Netlify sea correcta y vuelve a publicar.';
  }
  if (/quota|billing|insufficient_quota|rate limit|429/i.test(message)) {
    return 'Tu cuenta de OpenAI no tiene saldo disponible o llegó a su límite. Revisa Billing en platform.openai.com.';
  }
  if (/model.*(not found|does not exist|access)|does not have access to model/i.test(message)) {
    return 'El modelo de OpenAI configurado no está disponible para tu cuenta. Revisa OPENAI_MODEL_FAST en Netlify.';
  }
  return message;
}

function cleanHousehold(input: unknown, prompt: string): Household {
  const fromText = parseShoppingRequest(prompt);
  const given = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const num = (value: unknown, min: number, max: number): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  return {
    people: num(given.people, 1, 20) ?? fromText.people,
    days: num(given.days, 1, 31) ?? fromText.days,
    budget: num(given.budget, 50, 200000) ?? fromText.budget,
    store: typeof given.store === 'string' && given.store.trim() ? given.store.trim().slice(0, 30) : fromText.store,
  };
}

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  try {
    const body = JSON.parse(event.body || '{}');
    const isShopping = body.mode === 'shopping';
    const customPrompt = String(body.customPrompt || '');

    // En la lista de compras se envía solo lo necesario para que la respuesta sea rápida.
    const prefs = body.preferences || {};
    const compactPantry = (Array.isArray(body.pantry) ? body.pantry : []).slice(0, 80).map((p: any) => `${p.name} ${p.quantity ?? ''}${p.unit ?? ''}`.trim());
    const base = isShopping
      ? `Eres Alacena, un asistente doméstico para familias en México. Responde siempre en español de México y únicamente como JSON válido. Sé concreto y práctico. Dieta persona 1: ${prefs.diet_user || 'sin datos'}. Dieta persona 2: ${prefs.diet_partner || 'sin datos'}. Priorizar economía: ${prefs.budget_priority ? 'sí' : 'no'}. Ya hay en la despensa: ${JSON.stringify(compactPantry)}.`
      : `Eres Alacena, un asistente doméstico para familias en México. Responde siempre en español de México y únicamente como JSON válido. Sé concreto y práctico. Considera preferencias: ${JSON.stringify(body.preferences || {})}. Despensa: ${JSON.stringify(body.pantry || [])}. Sobrantes: ${JSON.stringify(body.leftovers || [])}. Recetas guardadas: ${JSON.stringify(body.recipes || [])}. Comidas recientes: ${JSON.stringify(body.recentMeals || [])}. No inventes que un producto está disponible si no aparece en la despensa.`;

    let prompt = base;
    let household: Household | null = null;
    if (isShopping) {
      household = cleanHousehold(body.household, customPrompt);
      const context = [
        `personas: ${household.people ?? 'no indicado (asume 4)'}`,
        `días: ${household.days ?? 'no indicado (asume 7)'}`,
        `presupuesto máximo en MXN: ${household.budget ?? 'no indicado'}`,
        `tienda: ${household.store ?? 'cualquier supermercado de México'}`,
      ].join('; ');
      const longTrip = (household.days ?? 7) >= 10;
      const range = longTrip ? '28 y 45' : '12 y 30';
      const catalog = (Array.isArray(body.catalog) ? body.catalog : []).slice(0, 260).map((x: unknown) => String(x).slice(0, 40)).filter(Boolean);
      const catalogRule = catalog.length
        ? ` (7) Esta es la lista maestra de productos que la familia suele comprar: ${catalog.join(', ')}. Cuando un producto de tu lista exista ahí, usa EXACTAMENTE ese nombre; prioriza estos productos y agrega fuera de la lista solo lo que el pedido realmente necesite.`
        : '';
      prompt += ` La persona pide: ${customPrompt || 'Crea una lista semanal del súper'}. Datos del hogar: ${context}. Genera una lista de compras realista y completa para ese hogar y ese periodo, agrupable por pasillos. Reglas: (1) entre ${range} productos con nombres genéricos y cortos, sin marcas (ej. "Pechuga de pollo"); (2) cantidad y unidad adecuadas para las personas y los días, usando solo estas unidades: pza, kg, g, L, ml, paquete, lata, bolsa, caja, docena; (3) estimated_price es el costo estimado TOTAL de esa línea en pesos mexicanos (número), aproximado, NO un precio real de la tienda; (4) la suma de estimated_price no debe pasar del presupuesto; si no alcanza, prioriza lo esencial y dilo en answer; (5) excluye lo que ya hay en cantidad suficiente en la despensa; (6) why máximo 8 palabras.${catalogRule} Devuelve exactamente este JSON: {"answer":"1 o 2 frases que resuman la lista y aclaren que los precios son estimaciones","items":[{"name":"producto","category":"Frutas y verduras|Carnes y pescado|Lácteos y huevos|Despensa|Limpieza y hogar|Otros","quantity":1,"unit":"pza","estimated_price":0,"why":"motivo breve"}]}.`;
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
    const result = await callOpenAI(content, { task, maxOutputTokens: isShopping ? ((household?.days ?? 7) >= 10 ? 3800 : 2600) : 2200, timeoutMs: 26000 });

    if (isShopping) {
      const plan = normalizeShoppingResponse(result);
      if (!plan.items.length) {
        return json(502, { error: 'La IA no devolvió productos válidos. Intenta de nuevo o describe tu lista con más detalle.' });
      }
      return json(200, {
        answer: plan.answer,
        items: plan.items,
        estimated_total: plan.estimated_total,
        household,
        estimates: true,
        _ai: (result as Record<string, unknown>)._ai,
      });
    }
    return json(200, result);
  } catch (error) {
    const message = friendlyAIError(error instanceof Error ? error.message : 'Error inesperado');
    console.error('[home-assistant] Error final', { message });
    return json(500, { error: message });
  }
};
