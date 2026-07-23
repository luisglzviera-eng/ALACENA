import { useEffect, useState } from 'react';
import { Bell, BellOff, Plus, Save, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fileToBase64 } from '../lib/utils';
import { Page } from '../components/UI';
import { CATEGORIES, type Category } from '../types';
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  getDevicePushSettings,
  pushSupported,
  updateDevicePushSettings,
} from '../lib/push';

type DeviceSettings = {
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

const defaultDeviceSettings: DeviceSettings = {
  expiry_alerts: true,
  menu_alerts: true,
  missing_ingredients_alerts: true,
  budget_alerts: true,
  recurring_alerts: true,
  expiry_days_before: 3,
  daily_menu_hour: 8,
  missing_ingredients_hour: 18,
  budget_threshold: 80,
  quiet_start: 21,
  quiet_end: 8,
  max_daily_notifications: 3,
};

export default function Settings() {
  const { preferences, savePreferences, recurring, saveRecurring } = useApp();
  const [form, setForm] = useState(preferences);
  const [loading, setLoading] = useState('');
  const [text, setText] = useState('');
  const [cat, setCat] = useState<Category>('Despensa');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [device, setDevice] = useState<DeviceSettings>(defaultDeviceSettings);

  useEffect(() => setForm(preferences), [preferences]);
  useEffect(() => {
    currentPushSubscription().then((subscription) => setPushEnabled(Boolean(subscription))).catch(() => {});
    getDevicePushSettings().then((value) => {
      if (value) setDevice({ ...defaultDeviceSettings, ...value });
    }).catch(() => {});
  }, []);

  const parse = async (file: File | undefined, person: 'user' | 'partner') => {
    if (!file) return;
    setLoading(person);
    try {
      const imageBase64 = await fileToBase64(file);
      const response = await fetch('/.netlify/functions/parse-diet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: file.type, person }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setForm((current) => ({ ...current, [person === 'user' ? 'diet_user' : 'diet_partner']: data.summary }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo leer');
    } finally { setLoading(''); }
  };

  const activatePush = async () => {
    setPushBusy(true); setPushMessage('');
    try {
      await enablePush();
      await updateDevicePushSettings(device);
      setPushEnabled(true);
      setForm((current) => ({ ...current, notifications_enabled: true }));
      setPushMessage('Notificaciones activadas en este dispositivo.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'No se pudieron activar.');
    } finally { setPushBusy(false); }
  };

  const turnOffPush = async () => {
    setPushBusy(true); setPushMessage('');
    try {
      await disablePush();
      setPushEnabled(false);
      setPushMessage('Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'No se pudieron desactivar.');
    } finally { setPushBusy(false); }
  };

  const saveAll = async () => {
    setPushBusy(true); setPushMessage('');
    try {
      await savePreferences(form);
      if (pushEnabled) await updateDevicePushSettings(device);
      setPushMessage('Preferencias guardadas.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'No se pudieron guardar.');
    } finally { setPushBusy(false); }
  };

  const setDeviceField = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) =>
    setDevice((current) => ({ ...current, [key]: value }));

  return <Page title="Preferencias" subtitle="Dietas, presupuesto, alertas y rutinas">
    <div className="card settings">
      <h3>Planes de alimentación</h3>
      <label>Persona 1<input type="file" accept="image/*" onChange={(event) => parse(event.target.files?.[0], 'user')} /></label>
      {loading === 'user' && <p><Sparkles />Analizando…</p>}
      <textarea rows={3} value={form.diet_user} onChange={(event) => setForm({ ...form, diet_user: event.target.value })} />
      <label>Persona 2<input type="file" accept="image/*" onChange={(event) => parse(event.target.files?.[0], 'partner')} /></label>
      <textarea rows={3} value={form.diet_partner} onChange={(event) => setForm({ ...form, diet_partner: event.target.value })} />
      <label>Presupuesto mensual<input type="number" value={form.monthly_budget} onChange={(event) => setForm({ ...form, monthly_budget: +event.target.value })} /></label>
      <label className="toggle"><span><strong>Opciones para niños</strong><small>Sabores sencillos y preparación rápida.</small></span><input type="checkbox" checked={form.kids_recipes} onChange={(event) => setForm({ ...form, kids_recipes: event.target.checked })} /></label>
      <label className="toggle"><span><strong>Priorizar lo económico</strong><small>Productos rendidores y de temporada.</small></span><input type="checkbox" checked={form.budget_priority} onChange={(event) => setForm({ ...form, budget_priority: event.target.checked })} /></label>
    </div>

    <div className="card settings notification-settings">
      <div className="section-title-row"><div><h3>Notificaciones de este dispositivo</h3><small>Funcionan con Alacena agregada a la pantalla de inicio.</small></div><span className={pushEnabled ? 'status enabled' : 'status'}>{pushEnabled ? 'Activas' : 'Inactivas'}</span></div>
      {!pushSupported() && <div className="notice warning">Para activarlas configura VITE_VAPID_PUBLIC_KEY, usa HTTPS y abre Alacena desde un navegador compatible. En iPhone debes agregarla primero a la pantalla de inicio.</div>}
      <label className="toggle"><span><strong>Productos por vencer</strong><small>Agrupa los productos en una sola alerta.</small></span><input type="checkbox" checked={device.expiry_alerts} onChange={(event) => setDeviceField('expiry_alerts', event.target.checked)} /></label>
      <label>Días de anticipación<select value={device.expiry_days_before} onChange={(event) => setDeviceField('expiry_days_before', +event.target.value)}><option value={1}>1 día</option><option value={2}>2 días</option><option value={3}>3 días</option><option value={5}>5 días</option><option value={7}>7 días</option></select></label>
      <label className="toggle"><span><strong>Menú del día</strong><small>Recuerda qué toca cocinar.</small></span><input type="checkbox" checked={device.menu_alerts} onChange={(event) => setDeviceField('menu_alerts', event.target.checked)} /></label>
      <label>Hora del menú<select value={device.daily_menu_hour} onChange={(event) => setDeviceField('daily_menu_hour', +event.target.value)}>{[7,8,9,10].map((hour) => <option value={hour} key={hour}>{hour}:00</option>)}</select></label>
      <label className="toggle"><span><strong>Ingredientes faltantes</strong><small>Revisa la lista antes de la comida del día siguiente.</small></span><input type="checkbox" checked={device.missing_ingredients_alerts} onChange={(event) => setDeviceField('missing_ingredients_alerts', event.target.checked)} /></label>
      <label>Hora de revisión<select value={device.missing_ingredients_hour} onChange={(event) => setDeviceField('missing_ingredients_hour', +event.target.value)}>{[16,17,18,19,20].map((hour) => <option value={hour} key={hour}>{hour}:00</option>)}</select></label>
      <label className="toggle"><span><strong>Presupuesto</strong><small>Avisa al superar el porcentaje indicado.</small></span><input type="checkbox" checked={device.budget_alerts} onChange={(event) => setDeviceField('budget_alerts', event.target.checked)} /></label>
      <label>Umbral de presupuesto<select value={device.budget_threshold} onChange={(event) => setDeviceField('budget_threshold', +event.target.value)}><option value={70}>70%</option><option value={80}>80%</option><option value={90}>90%</option><option value={100}>100%</option></select></label>
      <label className="toggle"><span><strong>Compras recurrentes</strong><small>Recuerda los artículos que vencen hoy.</small></span><input type="checkbox" checked={device.recurring_alerts} onChange={(event) => setDeviceField('recurring_alerts', event.target.checked)} /></label>
      <div className="settings-grid"><label>Silenciar desde<select value={device.quiet_start} onChange={(event) => setDeviceField('quiet_start', +event.target.value)}>{[20,21,22,23].map((hour) => <option value={hour} key={hour}>{hour}:00</option>)}</select></label><label>Hasta<select value={device.quiet_end} onChange={(event) => setDeviceField('quiet_end', +event.target.value)}>{[6,7,8,9].map((hour) => <option value={hour} key={hour}>{hour}:00</option>)}</select></label></div>
      <label>Máximo diario<select value={device.max_daily_notifications} onChange={(event) => setDeviceField('max_daily_notifications', +event.target.value)}><option value={1}>1 notificación</option><option value={2}>2 notificaciones</option><option value={3}>3 notificaciones</option><option value={5}>5 notificaciones</option></select></label>
      <div className="button-row">{pushEnabled ? <button className="secondary" disabled={pushBusy} onClick={turnOffPush}><BellOff />Desactivar en este equipo</button> : <button className="secondary" disabled={pushBusy || !pushSupported()} onClick={activatePush}><Bell />Activar notificaciones</button>}<button className="primary" disabled={pushBusy} onClick={saveAll}><Save />Guardar preferencias</button></div>
      {pushMessage && <p className="push-feedback" aria-live="polite">{pushMessage}</p>}
    </div>

    <div className="card settings">
      <h3>Compras recurrentes</h3>
      <div className="recurring-add"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Leche, huevos…" /><select value={cat} onChange={(event) => setCat(event.target.value as Category)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><button className="primary icon" onClick={async () => { if (!text) return; await saveRecurring({ text, category: cat, quantity: 1, unit: 'pza', frequency: 'weekly', next_due: new Date().toISOString().slice(0, 10), active: true }); setText(''); }}><Plus /></button></div>
      {recurring.map((item) => <div className="simple-row" key={item.id}><span>{item.text}</span><small>{item.frequency}</small></div>)}
    </div>
  </Page>;
}
