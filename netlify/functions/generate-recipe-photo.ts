import type { Handler } from '@netlify/functions';
import { json } from './_shared/openai';
import { friendlyAIError } from './_shared/errors';

const API = 'https://api.openai.com/v1/images/generations';

function buildPrompt(name: string, ingredients: string[]): string {
  const hint = ingredients.length ? ` Ingredientes visibles: ${ingredients.slice(0, 5).join(', ')}.` : '';
  return [
    `Fotografía gastronómica realista de "${name}", platillo casero mexicano servido en un plato sencillo.${hint}`,
    'Vista a 45 grados, luz natural suave de ventana, mesa de madera clara, fondo ligeramente desenfocado, colores cálidos y apetitosos.',
    'Sin texto, sin letras, sin logotipos, sin marcas, sin manos ni personas.',
  ].join(' ');
}

async function generate(key: string, model: string, prompt: string, signal: AbortSignal) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    signal,
    body: JSON.stringify({ model, prompt, size: '1536x1024', quality: 'low', n: 1, output_format: 'jpeg', output_compression: 70 }),
  });
  const raw = await response.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { throw new Error(`OpenAI devolvió una respuesta ilegible (${response.status})`); }
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI respondió con estado ${response.status}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || !b64) throw new Error('OpenAI no devolvió la imagen.');
  return b64;
}

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(500, { error: 'Falta OPENAI_API_KEY en Netlify' });
  try {
    const body = JSON.parse(event.body || '{}');
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (!name) return json(400, { error: 'Falta el nombre de la receta.' });
    const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : []).map((i: unknown) => String(i).slice(0, 40)).filter(Boolean);
    const prompt = buildPrompt(name, ingredients);

    const primary = process.env.OPENAI_MODEL_IMAGE || 'gpt-image-1-mini';
    const models = Array.from(new Set([primary, 'gpt-image-1']));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let lastError = 'No se pudo generar la foto.';
    try {
      for (const model of models) {
        try {
          const image = await generate(key, model, prompt, controller.signal);
          return json(200, { image, mime: 'image/jpeg', model });
        } catch (error) {
          lastError = error instanceof Error ? error.message : lastError;
          // Solo probamos el siguiente modelo si este no existe o no está disponible para la cuenta.
          if (!/model|does not exist|not found|access|verif/i.test(lastError)) break;
        }
      }
    } finally {
      clearTimeout(timer);
    }
    const message = /verif/i.test(lastError)
      ? 'OpenAI pide verificar tu organización para generar imágenes (platform.openai.com → Settings → Organization → Verify).'
      : friendlyAIError(lastError);
    return json(502, { error: message });
  } catch (error) {
    return json(500, { error: friendlyAIError(error instanceof Error ? error.message : 'Error inesperado') });
  }
};
