import type { Handler } from '@netlify/functions';
import { callOpenAI, json } from './_shared/openai';
import { friendlyAIError } from './_shared/errors';
import { normalizeReceiptResponse } from '../../src/lib/shopping';

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const { imageBase64, mediaType = 'image/jpeg', store = 'Otro' } = JSON.parse(event.body || '{}');
    if (!imageBase64) return json(400, { error: 'Falta la imagen del ticket.' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const type = allowed.includes(mediaType) ? mediaType : 'image/jpeg';
    const prompt = [
      `Lee este ticket de compra de supermercado en México (tienda probable: ${String(store).slice(0, 20)}: HEB, Calii o Calimax). Puede ser foto o captura de pantalla de la app.`,
      'Responde SOLO con JSON válido: {"store":"HEB|Calii|Calimax|Otro","date":"AAAA-MM-DD o null","items":[{"name":"","category":"Frutas y verduras|Carnes y pescado|Lácteos y huevos|Despensa|Limpieza y hogar|Otros","quantity":1,"unit_price":null,"total_price":0}],"total":0}',
      'Reglas: un renglón por producto con su nombre legible (expande abreviaturas del ticket cuando sea obvio, ej. "LCH ENT" = Leche entera). total_price es lo que costó ese renglón completo (cantidad × precio unitario). Si un producto se vende por peso, quantity es el peso en kg.',
      'Si un descuento aparece justo debajo de un producto, réstalo del total_price de ese producto. NO incluyas subtotal, IVA, cambio, forma de pago, propina ni puntos. "total" es el total pagado del ticket. Si no puedes leer algo, usa null; nunca inventes productos ni precios.',
      'La fecha debe ser la del ticket en formato AAAA-MM-DD (en México el formato suele ser día/mes/año).',
    ].join('\n');
    const data = await callOpenAI(
      [{ type: 'text', text: prompt }, { type: 'image', source: { type: 'base64', media_type: type, data: imageBase64 } }],
      { task: 'receipt_ocr', maxOutputTokens: 3000, timeoutMs: 26000 },
    );
    const receipt = normalizeReceiptResponse(data);
    if (!receipt.items.length) return json(502, { error: 'No pude leer productos en esa imagen. Prueba con una foto más cercana, con buena luz y el ticket completo.' });
    return json(200, receipt);
  } catch (error) {
    const message = friendlyAIError(error instanceof Error ? error.message : 'Error inesperado');
    console.error('[parse-receipt] Error', { message });
    return json(500, { error: message });
  }
};
