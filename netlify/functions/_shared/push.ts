import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublic && vapidPrivate) webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

export const admin = createClient(supabaseUrl || 'https://example.supabase.co', serviceRoleKey || 'missing-service-role', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function assertPushEnv() {
  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !vapidPublic && 'VITE_VAPID_PUBLIC_KEY',
    !vapidPrivate && 'VAPID_PRIVATE_KEY',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Faltan variables: ${missing.join(', ')}`);
}

export type PushRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  expiry_alerts: boolean;
  menu_alerts: boolean;
  missing_ingredients_alerts: boolean;
  budget_alerts: boolean;
  recurring_alerts: boolean;
  expiry_days_before: number;
  daily_menu_hour: number;
  missing_ingredients_hour: number;
  budget_threshold: number;
  quiet_start: number;
  quiet_end: number;
  max_daily_notifications: number;
};

export async function sendToSubscription(subscription: PushRow, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 6, urgency: 'normal' },
    );
    return { ok: true, error: undefined as string | undefined };
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('id', subscription.id);
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Push failed' };
  }
}

export function mexicoNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    weekday: get('weekday'),
  };
}

export function isQuietHour(hour: number, start: number, end: number) {
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export async function canSend(subscription: PushRow, dedupeKey: string, date: string) {
  const start = `${date}T00:00:00-06:00`;
  const end = `${date}T23:59:59-06:00`;
  const [{ count }, { data }] = await Promise.all([
    admin.from('notification_log').select('*', { count: 'exact', head: true }).eq('subscription_id', subscription.id).gte('sent_at', start).lte('sent_at', end).eq('status', 'sent'),
    admin.from('notification_log').select('id').eq('subscription_id', subscription.id).eq('dedupe_key', dedupeKey).maybeSingle(),
  ]);
  return !data && (count || 0) < subscription.max_daily_notifications;
}

export async function logPush(subscriptionId: string, type: string, dedupeKey: string, title: string, body: string, status: string, error?: string) {
  await admin.from('notification_log').insert({ subscription_id: subscriptionId, type, dedupe_key: dedupeKey, title, body, status, error_message: error || null });
}
