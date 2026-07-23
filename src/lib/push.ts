import { supabase, isConfigured } from './supabase';

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

export function pushSupported(): boolean {
  return Boolean(isConfigured && publicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePush(deviceName?: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error('Las notificaciones push no están disponibles o falta VITE_VAPID_PUBLIC_KEY.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Debes permitir las notificaciones desde el sistema.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey!),
    });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.');
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('El navegador no generó una suscripción válida.');

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
