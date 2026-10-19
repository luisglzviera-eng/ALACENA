import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Barcode, Check, Minus, Pencil, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { Empty, Page } from '../components/UI';
import { useApp } from '../context/AppContext';
import { CATEGORIES, type Category, type PantryItem } from '../types';
import { UNITS, expiryInfo, guessCategory, restockQuantity, stepForUnit, type NewGroceryRow } from '../lib/shopping';

type Filter = 'all' | 'expiring' | 'low';
type Form = { id?: string; name: string; category: Category; qty: string; unit: string; expires: string; low: string; barcode: string };
const EMPTY: Form = { name: '', category: 'Despensa', qty: '1', unit: 'pza', expires: '', low: '1', barcode: '' };
const num = (text: string, fallback: number) => { const n = Number(text.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : fallback; };
const decimal = (v: string) => /^\d*[.,]?\d*$/.test(v);

export default function Pantry() {
  const navigate = useNavigate();
  const { pantry, groceries, savePantry, deletePantry, addGroceryBatch } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [catTouched, setCatTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string; offer?: PantryItem } | null>(null);

  const info = (item: PantryItem) => expiryInfo(item.expires_on);
  const isExpiring = (item: PantryItem) => ['soon', 'expired'].includes(info(item).state);
  const isLow = (item: PantryItem) => Number(item.quantity) <= Number(item.low_stock_at);

  const counts = useMemo(() => ({ all: pantry.length, expiring: pantry.filter(isExpiring).length, low: pantry.filter(isLow).length }), [pantry]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (item: PantryItem) => (info(item).state === 'expired' ? 0 : info(item).state === 'soon' ? 1 : isLow(item) ? 2 : 3);
    return pantry
      .filter(item => (filter === 'expiring' ? isExpiring(item) : filter === 'low' ? isLow(item) : true))
      .filter(item => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'));
  }, [pantry, filter, query]);

  const toRows = (items: PantryItem[]): NewGroceryRow[] =>
    items.map(item => ({ name: item.name, category: item.category, quantity: restockQuantity(item.quantity, item.low_stock_at), unit: item.unit || 'pza', source: 'pantry' }));

  async function sendToList(items: PantryItem[]) {
    const result = await addGroceryBatch(toRows(items));
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    const dup = result.duplicates.length;
    setNotice({
      tone: 'ok',
      text: result.added > 0
        ? `Se ${result.added === 1 ? 'agregó 1 producto' : `agregaron ${result.added} productos`} a Compras.${dup ? ` ${dup === 1 ? '1 ya estaba' : `${dup} ya estaban`} en tu lista.` : ''}`
        : 'Esos productos ya estaban en tu lista de Compras.',
    });
  }

  async function adjust(item: PantryItem, direction: 1 | -1) {
    const step = stepForUnit(item.unit);
    const next = Math.max(0, Math.round((Number(item.quantity) + direction * step) * 1000) / 1000);
    if (next === Number(item.quantity)) return;
    const { error } = await savePantry({ id: item.id, quantity: next });
    if (error) return setNotice({ tone: 'error', text: error });
    setNotice(next === 0 ? { tone: 'ok', text: `Se acabó ${item.name}.`, offer: { ...item, quantity: 0 } } : null);
  }

  async function remove(item: PantryItem) {
    if (!window.confirm(`¿Quitar “${item.name}” de la despensa?`)) return;
    const { error } = await deletePantry(item.id);
    setNotice(error ? { tone: 'error', text: error } : { tone: 'ok', text: `Se quitó ${item.name}.` });
  }

  function openNew() { setCatTouched(false); setForm({ ...EMPTY }); }
  function openEdit(item: PantryItem) {
    setCatTouched(true);
    setForm({ id: item.id, name: item.name, category: item.category, qty: String(item.quantity), unit: item.unit || 'pza', expires: item.expires_on || '', low: String(item.low_stock_at ?? 1), barcode: item.barcode || '' });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    const name = form.name.trim();
    if (!name) return setNotice({ tone: 'error', text: 'Escribe el nombre del producto.' });
    setBusy(true);
    const payload = { name, category: form.category, quantity: num(form.qty, 1), unit: form.unit, expires_on: form.expires || null, low_stock_at: num(form.low, 1), barcode: form.barcode.trim() || null };
    const { error, merged } = await savePantry(form.id ? { id: form.id, ...payload } : payload);
    setBusy(false);
    if (error) return setNotice({ tone: 'error', text: error });
    setForm(null);
    setNotice({ tone: 'ok', text: form.id ? `Se actualizó ${name}.` : merged ? `Ya tenías ${name}: se sumó la cantidad.` : `Se agregó ${name} a la despensa.` });
  }

  const lowItems = pantry.filter(isLow);
  const tiles: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'Productos', count: counts.all },
    { id: 'expiring', label: 'Por caducar', count: counts.expiring },
    { id: 'low', label: 'Stock bajo', count: counts.low },
  ];

  return (
    <Page title="Despensa inteligente" subtitle={`${pantry.length} productos registrados`} action={<button className="primary small" onClick={openNew}><Plus size={17} />Agregar</button>}>
      {notice && (
        <div className={`ai-notice ${notice.tone === 'error' ? 'error' : ''}`} role="status">
          {notice.tone === 'ok' ? <Check size={18} /> : <AlertCircle size={18} />}{notice.text}
          {notice.offer && <button className="ghost small" onClick={() => void sendToList([notice.offer as PantryItem])}>Agregar a Compras</button>}
        </div>
      )}

      <div className="pn-tiles">
        {tiles.map(tile => (
          <button key={tile.id} type="button" className={`pn-tile ${filter === tile.id ? 'active' : ''} ${tile.id !== 'all' && tile.count > 0 ? 'alert' : ''}`} aria-pressed={filter === tile.id} onClick={() => setFilter(tile.id)}>
            <strong>{tile.count}</strong><span>{tile.label}</span>
          </button>
        ))}
      </div>

      {lowItems.length > 0 && (
        <button type="button" className="secondary pn-restock" onClick={() => void sendToList(lowItems)}>
          <ShoppingCart size={17} />Agregar faltantes a Compras ({lowItems.length})
        </button>
      )}

      {form && (
        <form className="card form-grid pn-form" onSubmit={submit}>
          <div className="pn-form-head"><strong>{form.id ? 'Editar producto' : 'Nuevo producto'}</strong><button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setForm(null)}><X size={18} /></button></div>
          <input placeholder="Producto" aria-label="Producto" value={form.name} onChange={e => { const name = e.target.value; setForm({ ...form, name, category: catTouched ? form.category : guessCategory(name) }); }} />
          <select aria-label="Categoría" value={form.category} onChange={e => { setCatTouched(true); setForm({ ...form, category: e.target.value as Category }); }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <div className="two">
            <input inputMode="decimal" aria-label="Cantidad" placeholder="Cantidad" value={form.qty} onChange={e => decimal(e.target.value) && setForm({ ...form, qty: e.target.value })} />
            <select aria-label="Unidad" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>{((UNITS as readonly string[]).includes(form.unit) ? [...UNITS] : [...UNITS, form.unit]).map(u => <option key={u} value={u}>{u}</option>)}</select>
          </div>
          <label>Caducidad (opcional)<input type="date" aria-label="Caducidad" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} /></label>
          <label>Avisar cuando quede esta cantidad o menos<input inputMode="decimal" aria-label="Avisar con" value={form.low} onChange={e => decimal(e.target.value) && setForm({ ...form, low: e.target.value })} /></label>
          <label className="barcode-field"><Barcode size={18} /><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Código de barras (opcional)" /></label>
          <button className="primary" disabled={busy}>{busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar'}</button>
        </form>
      )}

      <div className="search-bar"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en la despensa…" aria-label="Buscar en la despensa" /></div>

      {pantry.length === 0 ? <Empty>No has registrado productos.</Empty> : visible.length === 0 ? <Empty>No hay productos con ese filtro.</Empty> : (
        <div className="pantry-list">
          {visible.map(item => {
            const exp = info(item);
            const out = Number(item.quantity) <= 0;
            const low = isLow(item);
            return (
              <article className={`card pn-row ${exp.state === 'expired' ? 'expired' : exp.state === 'soon' ? 'expiring' : ''}`} key={item.id}>
                <div className="pn-main">
                  <strong>{item.name}</strong>
                  <small>{item.category}</small>
                  <div className="pn-badges">
                    {out ? <em className="sl-badge danger">Agotado</em> : low && <em className="sl-badge">Stock bajo</em>}
                    {exp.state !== 'none' && exp.state !== 'ok' && <em className={`sl-badge ${exp.state === 'expired' ? 'danger' : ''}`}>{exp.label}</em>}
                    {exp.state === 'ok' && <small>{exp.label}</small>}
                  </div>
                </div>
                <div className="pn-controls">
                  <div className="sl-stepper">
                    <button type="button" aria-label={`Menos ${item.name}`} onClick={() => void adjust(item, -1)} disabled={out}><Minus size={15} /></button>
                    <b className="pn-qty" aria-label={`Cantidad de ${item.name}`}>{Number(item.quantity)} {item.unit}</b>
                    <button type="button" aria-label={`Más ${item.name}`} onClick={() => void adjust(item, 1)}><Plus size={15} /></button>
                  </div>
                  <div className="pn-actions">
                    {(low || out) && <button type="button" className="icon-btn" aria-label={`Agregar ${item.name} a Compras`} title="Agregar a Compras" onClick={() => void sendToList([item])}><ShoppingCart size={17} /></button>}
                    <button type="button" className="icon-btn" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={17} /></button>
                    <button type="button" className="icon-btn" aria-label={`Quitar ${item.name}`} onClick={() => void remove(item)}><Trash2 size={17} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {groceries.length > 0 && notice?.tone === 'ok' && /Compras/.test(notice.text) && <button type="button" className="ghost" onClick={() => navigate('/lista')}>Ver Compras</button>}
    </Page>
  );
}
