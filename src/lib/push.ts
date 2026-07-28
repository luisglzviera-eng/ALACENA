import { supabase, isConfigured } from './supabase';

const publicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error('La llave pública de notificaciones contiene caracteres inválidos.');
  }

  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  let raw = '';
  try {
    raw = window.atob(base64);
  } catch {
    throw new Error('La llave pública de notificaciones no tiene un formato válido.');
  }

  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error('La llave VAPID pública es inválida. Debe ser la llave pública completa del mismo par que VAPID_PRIVATE_KEY.');
  }
  return bytes;
}

function keyIsValid(): boolean {
  if (!publicKey) return false;
  try {
    decodeVapidKey(publicKey);
    return true;
  } catch {
    return false;
  }
}

export function pushSupported(): boolean {
  return Boolean(
    isConfigured &&
      keyIsValid() &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  );
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePush(deviceName?: string): Promise<PushSubscription> {
  if (!isConfigured) throw new Error('Supabase no está configurado.');
  if (!publicKey) throw new Error('Falta configurar VITE_VAPID_PUBLIC_KEY en Netlify.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no admite notificaciones push.');
  }

  const applicationServerKey = decodeVapidKey(publicKey);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Debes permitir las notificaciones desde el navegador o el sistema.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch (error) {
      console.error('Push subscription error:', error);
      throw new Error('No fue posible activar las notificaciones. Revisa que las llaves VAPID pública y privada sean válidas y pertenezcan al mismo par.');
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.');
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('El navegador no generó una suscripción válida.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: authData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      device_name: deviceName || navigator.userAgent.slice(0, 120),
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
  return subscription;
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').update({ enabled: false }).eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

export async function updateDevicePushSettings(settings: Record<string, unknown>): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) throw new Error('Primero activa las notificaciones en este dispositivo.');
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('endpoint', subscription.endpoint);
  if (error) throw error;
}

export async function getDevicePushSettings() {
  const subscription = await currentPushSubscription();
  if (!subscription) return null;
  const { data, error } = await supabase.from('push_subscriptions').select('*').eq('endpoint', subscription.endpoint).maybeSingle();
  if (error) throw error;
  return data;
}
