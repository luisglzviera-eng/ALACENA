import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Camera, Check, ChevronDown, ChevronUp, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { money } from '../lib/utils';
import { shrinkImageToBase64 } from '../lib/image';
import { isConfigured, supabase } from '../lib/supabase';
import { CATEGORIES, type Category } from '../types';
import { RECEIPT_STORES as STORES, UNITS, findDuplicateReceipt, isFoodCategory, monthKey, monthReport, todayLocal } from '../lib/shopping';
import { Empty, Page } from '../components/UI';

type Row = { key: number; name: string; category: Category; quantity: string; unit: string; price: string; pantry: boolean };
type Notice = { tone: 'ok' | 'error' | 'warn'; text: string };
let rowKey = 1;
const num = (v: string) => { const n = Number(String(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function Tickets() {
  const { purchases, preferences, addPurchase, deletePurchase } = useApp();
  const [store, setStore] = useState<string>('HEB');
  const [date, setDate] = useState(todayLocal());
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toPantry, setToPantry] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const itemsSum = round2(rows.reduce((s, r) => s + num(r.price), 0));
  const totalNum = round2(num(total));
  const mismatch = rows.length > 0 && totalNum > 0 && Math.abs(totalNum - itemsSum) > 1;
  const duplicate = useMemo(() => (totalNum > 0 ? findDuplicateReceipt(purchases, { store, date, total: totalNum }) : null), [purchases, store, date, totalNum]);
  const thisMonth = monthReport(purchases, monthKey());
  const budget = Number(preferences.monthly_budget) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((thisMonth.total / budget) * 100)) : 0;

  async function read() {
    if (!file || reading) return;
    setReading(true); setReadError(''); setNotice(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const { base64, mime } = await shrinkImageToBase64(file);
      const res = await fetch('/.netlify/functions/parse-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ imageBase64: base64, mediaType: mime, store }) });
      let data: any = null;
      try { data = await res.json(); } catch { /* sin JSON: normalmente el límite de tiempo de Netlify */ }
      if (!res.ok || !data) throw new Error(data?.error || 'El servidor tardó demasiado en responder. Intenta de nuevo con una foto más pequeña o más cercana.');
      setRows((data.items || []).map((i: any) => ({ key: rowKey++, name: i.name, category: i.category, quantity: i.quantity == null ? '' : String(i.quantity), unit: i.unit || (i.quantity != null && !Number.isInteger(Number(i.quantity)) ? 'kg' : 'pza'), price: String(i.total_price), pantry: i.is_food !== false && isFoodCategory(i.category) })));
      setTotal(String(data.total || ''));
      if (data.store && STORES.includes(data.store)) setStore(data.store);
      if (data.date) setDate(data.date);
      setNotice({ tone: 'ok', text: `Leí ${data.items.length} productos. Revisa nombres y precios antes de guardar.` });
    } catch (e) {
      setReadError(e instanceof DOMException && e.name === 'AbortError' ? 'La IA tardó demasiado en leer el ticket. Intenta de nuevo.' : e instanceof TypeError ? 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' : e instanceof Error ? e.message : 'No se pudo leer el ticket.');
    } finally { clearTimeout(timer); setReading(false); }
  }

  const patch = (key: number, p: Partial<Row>) => setRows(v => v.map(r => (r.key === key ? { ...r, ...p } : r)));

  async function save() {
    if (saving) return;
    const items = rows.map(r => ({ name: r.name.trim(), category: r.category, quantity: r.quantity.trim() ? num(r.quantity) || null : null, unit: r.unit, unit_price: null as number | null, total_price: round2(num(r.price)), to_pantry: r.pantry })).filter(i => i.name);
    if (!items.length) return setNotice({ tone: 'error', text: 'Agrega al menos un producto.' });
    const finalTotal = totalNum > 0 ? totalNum : itemsSum;
    if (finalTotal <= 0) return setNotice({ tone: 'error', text: 'Falta el total del ticket.' });
    if (duplicate && !window.confirm(`Ya guardaste un ticket de ${store} del ${date} por ${money(finalTotal)}. ¿Guardarlo otra vez?`)) return;
    setSaving(true); setNotice(null);
    try {
      let image_path: string | null = null; let imageWarn = '';
      if (file && isConfigured) {
        const safe = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const up = await supabase.storage.from('receipts').upload(safe, file, { contentType: file.type, upsert: false });
        if (up.error) imageWarn = ' La foto no se pudo guardar, pero el ticket sí.'; else image_path = safe;
      }
      const res = await addPurchase({ store, purchase_date: date, image_path, total: finalTotal, status: 'confirmed', purchase_items: items }, toPantry);
      if (res.error) return setNotice({ tone: 'error', text: `No se guardó el ticket: ${res.error}` });
      setRows([]); setTotal(''); setFile(undefined); setReadError('');
      const skipped = rows.filter(r => !r.pantry).length;
      const pantryText = toPantry ? ` ${res.pantryAdded ?? 0} productos sumados a la despensa${skipped ? ` (${skipped} no se sumaron: no son comida o los desmarcaste)` : ''}.` : '';
      setNotice({ tone: res.warning || imageWarn ? 'warn' : 'ok', text: `Ticket guardado: ${money(finalTotal)}.${pantryText}${imageWarn}${res.warning ? ` Aviso: ${res.warning}` : ''}` });
    } finally { setSaving(false); }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`¿Borrar el ticket de ${label}? Los productos que ya sumaste a la despensa no se restan.`)) return;
    const { error } = await deletePurchase(id);
    setNotice(error ? { tone: 'error', text: error } : { tone: 'ok', text: 'Ticket borrado.' });
  }

  return (
    <Page title="Tickets" subtitle="Registra y revisa tus compras">
      <div className="card tk-month">
        <div><small>Este mes llevas</small><strong>{money(thisMonth.total)}</strong>{budget > 0 && <small> de {money(budget)} · {pct}%</small>}</div>
        {budget > 0 && <div className="tk-bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: pct >= 100 ? '#b3472f' : undefined }} /></div>}
      </div>

      {notice && <div className={`tk-notice ${notice.tone}`} role="status">{notice.tone === 'ok' ? <Check size={18} /> : <AlertCircle size={18} />}<span>{notice.text}</span><button type="button" className="icon-btn" aria-label="Cerrar aviso" onClick={() => setNotice(null)}><X size={16} /></button></div>}

      <div className="card ticket-form">
        <div className="form-grid">
          <label>Tienda<select value={store} onChange={e => setStore(e.target.value)}>{STORES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Fecha<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        </div>
        <label className="file-drop"><Camera /><span>{file ? file.name : 'Tomar foto o elegir captura del ticket'}</span><input type="file" accept="image/*" onChange={e => { setFile(e.target.files?.[0]); setReadError(''); }} /></label>
        {preview && <img className="tk-preview" src={preview} alt="Vista previa del ticket" />}
        <button type="button" className="primary" disabled={!file || reading} onClick={() => void read()}><Sparkles size={16} /> {reading ? 'Leyendo ticket…' : 'Leer ticket con IA'}</button>
        {readError && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No pude leer el ticket</strong><p>{readError}</p></div><button type="button" className="secondary small" onClick={() => void read()}>Reintentar</button></div>}
        {!rows.length && <button type="button" className="ghost small" onClick={() => setRows([{ key: rowKey++, name: '', category: 'Despensa', quantity: '', unit: 'pza', price: '', pantry: true }])}>O captura los productos a mano</button>}
      </div>

      {rows.length > 0 && (
        <div className="card tk-review">
          <h3>Revisa antes de guardar</h3>
          {rows.map(r => (
            <div className="tk-row" key={r.key}>
              <input value={r.name} placeholder="Producto" aria-label="Producto" onChange={e => patch(r.key, { name: e.target.value })} />
              <select value={r.category} aria-label="Categoría" onChange={e => patch(r.key, { category: e.target.value as Category, pantry: isFoodCategory(e.target.value) })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              <input value={r.quantity} inputMode="decimal" placeholder="Cant." aria-label={`Cantidad de ${r.name || 'producto'}`} onChange={e => patch(r.key, { quantity: e.target.value })} />
              <select value={r.unit} aria-label={`Unidad de ${r.name || 'producto'}`} onChange={e => patch(r.key, { unit: e.target.value })}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
              <input value={r.price} inputMode="decimal" placeholder="$" aria-label="Precio" onChange={e => patch(r.key, { price: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={`Quitar ${r.name || 'producto'}`} onClick={() => setRows(v => v.filter(x => x.key !== r.key))}><X size={16} /></button>
              {r.pantry && r.unit === 'pza' && ['Carnes y pescado', 'Frutas y verduras'].includes(r.category) && <small className="tk-hint">¿Se vende por peso? Pon cuántos kg trae y cambia la unidad a kg.</small>}
              <label className="tk-pantry"><input type="checkbox" checked={r.pantry} onChange={e => patch(r.key, { pantry: e.target.checked })} aria-label={`Sumar ${r.name || 'producto'} a la despensa`} /><span>{r.pantry ? 'Va a la despensa' : isFoodCategory(r.category) ? 'No se suma a la despensa' : 'No es comida · no va a la despensa'}</span></label>
            </div>
          ))}
          <button type="button" className="ghost small" onClick={() => setRows(v => [...v, { key: rowKey++, name: '', category: 'Despensa', quantity: '', unit: 'pza', price: '', pantry: true }])}><Plus size={15} /> Agregar producto</button>
          <label className="tk-total">Total del ticket<input value={total} inputMode="decimal" placeholder={String(itemsSum)} onChange={e => setTotal(e.target.value)} /></label>
          <small className="muted">Suma de productos: {money(itemsSum)}</small>
          {mismatch && <div className="tk-notice warn"><AlertCircle size={18} /><span>Los productos suman {money(itemsSum)} y el total dice {money(totalNum)}. Puede faltar algún producto o haber descuentos.</span><button type="button" className="secondary small" onClick={() => setTotal(String(itemsSum))}>Usar la suma</button></div>}
          {duplicate && <div className="tk-notice warn"><AlertCircle size={18} /><span>Ya tienes un ticket de {store} del {date} por {money(totalNum)}. ¿Es el mismo?</span></div>}
          <label className="toggle"><span><strong>Sumar a la despensa</strong><small>Agrega estos productos a lo que ya tienes (sin duplicar).</small></span><input type="checkbox" checked={toPantry} onChange={e => setToPantry(e.target.checked)} /></label>
          <button type="button" className="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar ticket'}</button>
        </div>
      )}

      <h3 className="section-title">Compras recientes</h3>
      {purchases.length === 0 ? <Empty>Aún no has guardado tickets.</Empty> : purchases.map(p => (
        <article className="card purchase" key={p.id}>
          <button type="button" onClick={() => setOpen(open === p.id ? undefined : p.id)}>
            <span><strong>{p.store}</strong><small>{p.purchase_date}</small></span><b>{money(p.total)}</b>{open === p.id ? <ChevronUp /> : <ChevronDown />}
          </button>
          {open === p.id && (
            <div>
              {(p.purchase_items || []).map((i, n) => <p key={n}><span>{i.name}</span><b>{money(i.total_price)}</b></p>)}
              <button type="button" className="ghost small tk-del" onClick={() => void remove(p.id, `${p.store} del ${p.purchase_date}`)}><Trash2 size={15} /> Borrar ticket</button>
            </div>
          )}
        </article>
      ))}
    </Page>
  );
}
