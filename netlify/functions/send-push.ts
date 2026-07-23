import type { Handler } from '@netlify/functions';
import { admin, assertPushEnv, sendToSubscription, type PushRow } from './_shared/push';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    assertPushEnv();
    const secret = event.headers['x-alacena-secret'];
    if (!process.env.PUSH_ADMIN_SECRET || secret !== process.env.PUSH_ADMIN_SECRET) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const input = JSON.parse(event.body || '{}');
    if (!input.title || !input.body) return { statusCode: 400, body: JSON.stringify({ error: 'title y body son obligatorios' }) };
    let query = admin.from('push_subscriptions').select('*').eq('enabled', true);
    if (input.user_id) query = query.eq('user_id', input.user_id);
    const { data, error } = await query;
    if (error) throw error;
    const results = await Promise.all((data as PushRow[]).map((row) => sendToSubscription(row, {
      title: input.title, body: input.body, url: input.url || '/inicio', tag: input.tag || 'alacena-manual',
    })));
    return { statusCode: 200, body: JSON.stringify({ sent: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }) };
  }
};
