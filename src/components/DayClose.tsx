import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MENU_SLOTS, SLOT_LABEL, isStapleName, planDeductions, stepForUnit, todayLocal } from '../lib/shopping';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** "Cerrar el día": confirma lo que sí se cocinó, descuenta de la despensa y deja ajustar los básicos con un conteo rápido. */
export default function DayClose({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { weeks, recipes, pantry, savePantry, saveWeekDays } = useApp();
  const active = weeks.find(w => !w.archived);
  const day = DAY_NAMES[new Date().getDay()];
  const today = todayLocal();
  const dayData = (active?.days[day] || {}) as Record<string, string>;
  const meals = MENU_SLOTS.map(slot => ({ slot, text: String(dayData[slot] ?? '').trim() })).filter(m => m.text);
  const closed = dayData.closed === today;

  const [open, setOpen] = useState(defaultOpen);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const chosen = meals.filter(m => !off[m.slot]);
  const plan = useMemo(() => planDeductions(chosen.map(m => m.text), recipes, pantry), [chosen.map(m => m.text).join('|'), recipes, pantry]);
  const toTake = plan.lines.filter(l => l.itemId && l.take > 0);
  const staples = pantry.filter(p => isStapleName(p.name) && Number(p.quantity) >= 0).slice(0, 8);

  if (!active) return null;

  async function markClosed() {
    return saveWeekDays({ ...active!.days, [day]: { ...(active!.days[day] || {}), closed: today } } as any);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const byItem = new Map<string, number>();
      for (const l of toTake) byItem.set(l.itemId as string, (byItem.get(l.itemId as string) || 0) + l.take);
      for (const [id, take] of byItem) {
        const item = pantry.find(p => p.id === id);
        if (!item) continue;
        const r = await savePantry({ id, quantity: Math.max(0, Math.round((Number(item.quantity) - take) * 1000) / 1000) });
        if (r.error) return setMsg({ tone: 'error', text: `No se pudo descontar ${item.name}: ${r.error}` });
      }
      const r = await markClosed();
      if (r.error) return setMsg({ tone: 'error', text: r.error });
      setMsg({ tone: 'ok', text: byItem.size ? `Listo: se descontaron ${byItem.size} productos de la despensa.` : 'Día cerrado.' });
    } finally { setBusy(false); }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    try { const r = await markClosed(); setMsg(r.error ? { tone: 'error', text: r.error } : { tone: 'ok', text: 'Día cerrado sin descontar nada.' }); } finally { setBusy(false); }
  }

  async function adjust(id: string, name: string, quantity: number, delta: number, unit: string) {
    const next = Math.max(0, Math.round((quantity + delta * stepForUnit(unit)) * 1000) / 1000);
    const r = await savePantry({ id, quantity: next });
    if (r.error) setMsg({ tone: 'error', text: `No se pudo ajustar ${name}: ${r.error}` });
  }

  const header = closed ? 'Día cerrado' : 'Cerrar el día';
  return (
    <section className="card dc-card" aria-label="Cerrar el día">
      <button type="button" className="dc-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="dc-icon">{closed ? <Check size={18} /> : <Moon size={18} />}</span>
        <span><strong>{header}</strong><small>{closed ? 'Ya se descontó lo de hoy.' : meals.length ? `¿Cocinaron lo de hoy? ${meals.length} comidas planeadas` : 'No hay comidas planeadas hoy'}</small></span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {msg && <p className={`dc-msg ${msg.tone}`} role="status">{msg.text}</p>}
      {open && !closed && (
        <div className="dc-body">
          {meals.length === 0 ? <p className="muted">Planea comidas en Menú para que se puedan descontar.</p> : (
            <>
              <p className="muted">Deja marcado lo que sí cocinaron. Lo que no, desmárcalo.</p>
              {meals.map(m => (
                <label className="dc-meal" key={m.slot}>
                  <input type="checkbox" checked={!off[m.slot]} onChange={e => setOff(o => ({ ...o, [m.slot]: !e.target.checked }))} />
                  <span><b>{SLOT_LABEL[m.slot]}:</b> {m.text}</span>
                </label>
              ))}
              {toTake.length > 0 && (
                <div className="dc-preview">
                  <strong>Se va a descontar:</strong>
                  {toTake.map(l => <p key={`${l.itemId}-${l.name}`}><span>{l.itemName}</span><b>−{fmt(l.take)} {l.takeUnit}{l.status === 'short' ? ' (era más de lo que había)' : ''}</b></p>)}
                </div>
              )}
              {plan.lines.some(l => l.status === 'unit') && <small className="muted">No pude calcular {plan.lines.filter(l => l.status === 'unit').map(l => l.name).join(', ')}: la receta y la despensa usan unidades distintas. Ajústalo con los botones.</small>}
              {plan.withoutRecipe.length > 0 && <small className="muted">Sin receta guardada (no sé sus ingredientes): {plan.withoutRecipe.join(', ')}.</small>}
            </>
          )}
          {staples.length > 0 && (
            <div className="dc-staples">
              <strong>Básicos: ¿cuánto queda?</strong>
              <small className="muted">Esto es lo que se consume sin plan (leche, huevos, pan…). Ajusta a ojo.</small>
              {staples.map(p => (
                <div className="dc-staple" key={p.id}>
                  <span>{p.name}</span>
                  <div className="sl-stepper"><button type="button" aria-label={`Menos ${p.name}`} onClick={() => void adjust(p.id, p.name, Number(p.quantity), -1, p.unit)}>−</button><b className="pn-qty">{fmt(Number(p.quantity))} {p.unit}</b><button type="button" aria-label={`Más ${p.name}`} onClick={() => void adjust(p.id, p.name, Number(p.quantity), 1, p.unit)}>+</button></div>
                </div>
              ))}
            </div>
          )}
          <div className="dc-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Guardando…' : toTake.length ? 'Descontar y cerrar el día' : 'Cerrar el día'}</button>
            <button type="button" className="ghost small" disabled={busy} onClick={() => void skip()}>No cocinamos lo planeado</button>
          </div>
        </div>
      )}
    </section>
  );
}
