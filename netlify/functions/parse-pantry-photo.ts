import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';
import { friendlyAIError } from './_shared/errors';
import { normalizePantryPhotoResponse } from '../../src/lib/shopping';

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const { imageBase64, mediaType = 'image/jpeg', place = '' } = JSON.parse(event.body || '{}');
    if (!imageBase64) return json(400, { error: 'Falta la foto.' });
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg';
    const prompt = [
      `Mira esta foto del interior de un ${String(place).slice(0, 30) || 'refrigerador, congelador o alacena'} de una casa en México y lista los productos que se distinguen.`,
      'Responde SOLO con JSON válido: {"items":[{"name":"","category":"Frutas y verduras|Carnes y pescado|Lácteos y huevos|Despensa|Limpieza y hogar|Otros","quantity":1,"unit":"pza|kg|g|L|ml","estimated":false}]}',
      'Reglas: un renglón por tipo de producto. name = nombre legible con marca y presentación SOLO si se alcanza a leer (ej. "Leche Santa Clara entera 1 L", "Yogurt Danonino fresa"). quantity = cuántas piezas/envases iguales ves (cuéntalas); si algo se vende por peso y no se ve el peso, pon quantity 1 unit "pza" y estimated true.',
      'estimated = true cuando no estás seguro de la cantidad (producto tapado, a medias, en bolsa opaca, fruta o verdura a granel, o no lo cuentas bien). Si estás seguro de lo que ves, estimated false.',
      'Usa SIEMPRE el español de México y los nombres que se usan en casa: Plátano (no banana), Aguacate (no palta), Elote (no choclo), Jitomate/Tomate, Durazno, Frijol, Crema (no nata), Yogurt, Jugo (no zumo), Carne molida, Camarones, Papel de baño, Pasta dental. Nombres cortos y simples: "Naranja", "Manzana amarilla", "Leche", "Queso Oaxaca".',
      'No inventes productos que no se ven. Si un envase no se puede identificar, omítelo. Ignora platos, utensilios y contenedores vacíos. Si hay sobras en recipientes sin etiqueta, ponlas como "Sobras (recipiente)" con estimated true.',
    ].join('\n');
    const data = await callOpenAI(
      [{ type: 'text', text: prompt }, { type: 'image', source: { type: 'base64', media_type: type, data: imageBase64 } }],
      { task: 'fridge_analysis', maxOutputTokens: 2500, timeoutMs: 26000 },
    );
    const items = normalizePantryPhotoResponse(data);
    if (!items.length) return json(502, { error: 'No pude identificar productos en esa foto. Acércate más, con buena luz y sin que el flash refleje.' });
    return json(200, { items });
  } catch (error) {
    const message = friendlyAIError(error instanceof Error ? error.message : 'Error inesperado');
    console.error('[parse-pantry-photo] Error', { message });
    return json(500, { error: message });
  }
};
