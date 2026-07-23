import type { Handler } from '@netlify/functions';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { admin, assertPushEnv, canSend, isQuietHour, logPush, mexicoNow, sendToSubscription, type PushRow } from './_shared/push';

const dayMap: Record<string, string> = { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' };

async function deliver(subscription: PushRow, type: string, key: string, title: string, body: string, url: string, date: string) {
  if (!(await canSend(subscription, key, date))) return false;
  const result = await sendToSubscription(subscription, { title, body, url, tag: key });
  await logPush(subscription.id, type, key, title, body, result.ok ? 'sent' : 'failed', result.error);
  return result.ok;
}

export const handler: Handler = async () => {
  try {
    assertPushEnv();
    const now = mexicoNow();
    const { data: rows, error } = await admin.from('push_subscriptions').select('*').eq('enabled', true);
    if (error) throw error;
    const subscriptions = (rows || []) as PushRow[];
    let sent = 0;

    const [{ data: pantry }, { data: week }, { data: preferences }, { data: purchases }, { data: recurring }, { data: groceries }] = await Promise.all([
      admin.from('pantry_items').select('id,name,expires_on').not('expires_on', 'is', null),
      admin.from('menu_weeks').select('days').eq('archived', false).maybeSingle(),
      admin.from('preferences').select('monthly_budget').eq('id', 1).maybeSingle(),
      admin.from('purchases').select('total,purchase_date').gte('purchase_date', `${now.date.slice(0, 7)}-01`),
      admin.from('recurring_items').select('id,text,next_due').eq('active', true).lte('next_due', now.date),
      admin.from('grocery_items').select('id,text,checked').eq('checked', false),
    ]);

    for (const subscription of subscriptions) {
      if (isQuietHour(now.hour, subscription.quiet_start, subscription.quiet_end)) continue;

      if (subscription.expiry_alerts && now.hour === 8) {
        const expiring = (pantry || []).filter((item: any) => {
          const days = differenceInCalendarDays(new Date(`${item.expires_on}T12:00:00`), new Date(`${now.date}T12:00:00`));
          return days >= 0 && days <= subscription.expiry_days_before;
        });
        if (expiring.length) {
          const names = expiring.slice(0, 3).map((item: any) => item.name).join(', ');
          const extra = expiring.length > 3 ? ` y ${expiring.length - 3} más` : '';
          if (await deliver(subscription, 'expiry', `expiry:${now.date}`, 'Productos por vencer', `${names}${extra}. Revísalos para aprovecharlos a tiempo.`, '/despensa', now.date)) sent++;
        }
      }

      if (subscription.menu_alerts && now.hour === subscription.daily_menu_hour) {
        const day = dayMap[now.weekday];
        const meals = week?.days?.[day];
        if (meals?.lunch || meals?.dinner) {
          const body = [meals.lunch && `Comida: ${meals.lunch}`, meals.dinner && `Cena: ${meals.dinner}`].filter(Boolean).join(' · ');
          if (await deliver(subscription, 'menu', `menu:${now.date}`, 'Menú de hoy', body, '/menu', now.date)) sent++;
        }
      }

      if (subscription.missing_ingredients_alerts && now.hour === subscription.missing_ingredients_hour && (groceries || []).length) {
        const tomorrow = format(addDays(new Date(`${now.date}T12:00:00`), 1), 'yyyy-MM-dd');
        const names = (groceries || []).slice(0, 3).map((item: any) => item.text).join(', ');
        const extra = (groceries || []).length > 3 ? ` y ${(groceries || []).length - 3} más` : '';
        if (await deliver(subscription, 'missing', `missing:${tomorrow}`, 'Revisa lo que falta para mañana', `Tienes pendientes: ${names}${extra}.`, '/lista', now.date)) sent++;
      }

      if (subscription.budget_alerts && now.hour === 12 && preferences?.monthly_budget) {
        const total = (purchases || []).reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
        const percentage = Math.floor((total / Number(preferences.monthly_budget)) * 100);
        const threshold = percentage >= 100 ? 100 : subscription.budget_threshold;
        if (percentage >= threshold) {
          if (await deliver(subscription, 'budget', `budget:${now.date.slice(0, 7)}:${threshold}`, 'Seguimiento de presupuesto', `Han utilizado ${percentage}% del presupuesto mensual.`, '/reportes', now.date)) sent++;
        }
      }

      if (subscription.recurring_alerts && now.hour === 9 && (recurring || []).length) {
        const names = (recurring || []).slice(0, 4).map((item: any) => item.text).join(', ');
        if (await deliver(subscription, 'recurring', `recurring:${now.date}`, 'Compras habituales pendientes', `Hoy corresponde agregar: ${names}.`, '/ajustes', now.date)) sent++;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ checked: subscriptions.length, sent, localTime: now }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }) };
  }
};
