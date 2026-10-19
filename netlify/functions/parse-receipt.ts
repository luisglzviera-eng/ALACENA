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
      `Lee este ticket de compra de supermercado en México (tienda probable: ${String(store).slice(0, 20)}; pueden ser HEB, Costco, Sam’s, Calii u otra). Puede ser foto, captura de pantalla de la app o ticket largo.`,
      'Responde SOLO con JSON válido: {"store":"HEB|Costco|Sam’s|Calii|Otro","date":"AAAA-MM-DD o null","items":[{"name":"","category":"Frutas y verduras|Carnes y pescado|Lácteos y huevos|Despensa|Limpieza y hogar|Otros","quantity":1,"unit_price":null,"is_food":true,"total_price":0}],"total":0}',
      'Reglas: un renglón por producto con su nombre legible (expande abreviaturas del ticket cuando sea obvio, ej. "LCH ENT" = Leche entera). total_price es lo que costó ese renglón completo (cantidad × precio unitario). Si un producto se vende por peso, quantity es el peso en kg.',
      'Si un descuento aparece justo debajo de un producto, réstalo del total_price de ese producto. NO incluyas subtotal, IVA, cambio, forma de pago, propina ni puntos. "total" es el total pagado del ticket. Si no puedes leer algo, usa null; nunca inventes productos ni precios.',
      'is_food: true si es comida o bebida que se guarda en la despensa o refri; false si NO es comida (limpieza, papel, higiene personal, pañales/bebé, mascotas, farmacia, hogar, ropa, electrónica, bolsas, etc.). Los productos que NO son comida usan category "Limpieza y hogar" (limpieza, papel, higiene, bebé, mascotas, hogar) u "Otros" (todo lo demás); la comida nunca usa esas dos categorías.',
      'En Costco y Sam’s los renglones traen código de artículo y a veces la marca (KS, Member’s Mark): ignora el código, deja el nombre del producto y respeta el precio total del renglón; los descuentos aparecen en un renglón aparte con "-" justo debajo del producto.',
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
