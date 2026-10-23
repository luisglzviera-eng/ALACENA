import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isConfigured, supabase } from '../lib/supabase';
import { buildCatalog, filterCatalog, haveInPantry, type CatalogRow } from '../lib/catalog';
import { findDuplicate } from '../lib/shopping';

const SQL_HINT = 'Para guardar cambios al catálogo falta correr el SQL update_v8_13_catalogo en Supabase.';

export default function Catalog({ onClose }: { onClose: () => void }) {
  const { groceries, pantry, addGroceryBatch } = useApp();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [added, setAdded] = useState(0);
  const [newName, setNewName] = useState('');
  const [newSection, setNewSection] = useState('');
  const [pick, setPick] = useState<{ name: string; category: any; section: string } | null>(null);
  const [qtyText, setQtyText] = useState('1');
  const [unit, setUnit] = useState('pza');

  useEffect(() => {
    if (!isConfigured) return;
    let live = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('catalog_items').select('*');
        if (!live || error) return;
        setRows((data || []) as CatalogRow[]);
      } catch { /* sin tabla: se usa el catálogo base */ }
    })();
    return () => { live = false; };
  }, []);

  const catalog = useMemo(() => buildCatalog(rows), [rows]);
  const shown = useMemo(() => filterCatalog(catalog, query), [catalog, query]);
  const pending = useMemo(() => groceries.filter(g => !g.checked).map(g => ({ text: g.text, checked: false })), [groceries]);
  const stocked = useMemo(() => pantry.filter(p => Number(p.quantity) > 0).map(p => p.name), [pantry]);

  function choose(name: string, category: any, section: string) { setPick({ name, category, section }); setQtyText('1'); setUnit('pza'); setNote(null); }

  async function confirmAdd() {
    if (!pick) return;
    const qty = Number(qtyText.replace(',', '.'));
    const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const res = await addGroceryBatch([{ name: pick.name, category: pick.category, quantity, unit, source: 'catalog' }]);
    if (res.error) return setNote({ tone: 'error', text: res.error });
    if (res.added) { setAdded(n => n + 1); setNote({ tone: 'ok', text: `Se agregó ${pick.name} (${quantity} ${unit}).` }); }
    setPick(null);
  }

  async function saveRow(row: CatalogRow) {
    if (!isConfigured) { setRows(v => [...v, row]); return true; }
    try {
      const { data, error } = await supabase.from('catalog_items').insert({ section: row.section, name: row.name, hidden: Boolean(row.hidden) }).select();
      if (error) { setNote({ tone: 'error', text: /catalog_items|relation|does not exist/i.test(error.message || '') ? SQL_HINT : error.message }); return false; }
      setRows(v => [...v, ...((data || []) as CatalogRow[])]);
      return true;
    } catch { setNote({ tone: 'error', text: SQL_HINT }); return false; }
  }

  async function removeItem(section: string, name: string) {
    const custom = rows.find(r => !r.hidden && r.section === section && r.name.toLowerCase() === name.toLowerCase());
    if (custom?.id && isConfigured) {
      const { error } = await supabase.from('catalog_items').delete().eq('id', custom.id);
      if (error) return setNote({ tone: 'error', text: error.message });
      return setRows(v => v.filter(r => r.id !== custom.id));
    }
    if (custom) return setRows(v => v.filter(r => r !== custom));
    await saveRow({ section, name, hidden: true });
  }

  async function addCustom(section: string) {
    const name = (adding[section] || '').trim();
    if (!name) return;
    if (await saveRow({ section, name })) setAdding(a => ({ ...a, [section]: '' }));
  }

  return (
    <section className="card cat-box" aria-label="Catálogo del súper">
      <div className="cat-head"><div><strong>Mi catálogo del súper</strong><small>Toca un producto para agregarlo a la lista{added ? ` · ${added} agregados` : ''}</small></div>
        <div className="cat-actions"><button type="button" className={`ghost small ${editing ? 'on' : ''}`} onClick={() => setEditing(e => !e)}><Pencil size={15} />{editing ? 'Listo' : 'Agregar / quitar'}</button><button type="button" className="icon-btn" aria-label="Cerrar catálogo" onClick={onClose}><X size={18} /></button></div></div>
      <div className="search-bar"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en el catálogo…" aria-label="Buscar en el catálogo" /></div>
      {editing && (
        <div className="cat-edit">
          <p className="muted">Agrega un producto nuevo o abre una sección y toca la ✕ de los que quieras quitar.</p>
          <form className="cat-newform" onSubmit={e => { e.preventDefault(); const sec = newSection || catalog[0]?.name || ''; if (!newName.trim() || !sec) return; void saveRow({ section: sec, name: newName.trim() }).then(ok => { if (ok) { setNewName(''); setOpen(sec); setNote({ tone: 'ok', text: `Se agregó ${newName.trim()} al catálogo.` }); } }); }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Producto nuevo" aria-label="Nombre del nuevo producto" />
            <select value={newSection || catalog[0]?.name || ''} onChange={e => setNewSection(e.target.value)} aria-label="Sección del nuevo producto">{catalog.map(s => <option key={s.name}>{s.name}</option>)}</select>
            <button className="primary small">Agregar al catálogo</button>
          </form>
        </div>
      )}
      {note && <div className={`ai-notice ${note.tone === 'error' ? 'error' : ''}`} role="status">{note.text}</div>}
      {shown.length === 0 && <p className="muted">No hay productos con ese nombre.</p>}
      {shown.map(sec => {
        const isOpen = Boolean(query) || open === sec.name;
        return (
          <div className="cat-sec" key={sec.name}>
            <button type="button" className="cat-sec-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen && !query ? null : sec.name)}><span>{sec.name}</span><small>{sec.items.length}</small><ChevronDown size={18} className={isOpen ? 'up' : ''} /></button>
            {isOpen && (
              <div className="cat-chips">
                {sec.items.map(name => {
                  const onList = Boolean(findDuplicate(pending, name));
                  const have = haveInPantry(name, stocked);
                  return (
                    <span className="cat-chip-wrap" key={name}>
                      <button type="button" className={`cat-chip${onList ? ' on' : ''}${have ? ' have' : ''}`} disabled={onList || editing} aria-label={onList ? `${name}, ya en la lista` : `Agregar ${name}`} onClick={() => choose(name, sec.category, sec.name)}>
                        {onList && <Check size={13} />}{name}{have && !onList && <em>tienes</em>}
                      </button>
                      {editing && <button type="button" className="cat-x" aria-label={`Quitar ${name} del catálogo`} onClick={() => void removeItem(sec.name, name)}><X size={13} /></button>}
                    </span>
                  );
                })}
                {pick && pick.section === sec.name && !editing && (
                  <div className="cat-qty" role="group" aria-label={`Cantidad de ${pick.name}`}>
                    <strong>{pick.name}</strong>
                    <div className="cat-qty-row">
                      <button type="button" className="icon-btn" aria-label="Menos" onClick={() => setQtyText(String(Math.max(0.5, (Number(qtyText.replace(',', '.')) || 1) - 1)))}>−</button>
                      <input type="text" inputMode="decimal" aria-label="Cantidad a agregar" value={qtyText} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setQtyText(v); }} />
                      <button type="button" className="icon-btn" aria-label="Más" onClick={() => setQtyText(String((Number(qtyText.replace(',', '.')) || 0) + 1))}>+</button>
                      <select value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unidad">{['pza', 'kg', 'g', 'L', 'ml', 'paquete', 'caja', 'bolsa', 'docena'].map(u => <option key={u}>{u}</option>)}</select>
                    </div>
                    <div className="cat-qty-row"><button type="button" className="primary small" onClick={() => void confirmAdd()}>Agregar a la lista</button><button type="button" className="ghost small" onClick={() => setPick(null)}>Cancelar</button></div>
                  </div>
                )}
                {editing && <form className="cat-add" onSubmit={e => { e.preventDefault(); void addCustom(sec.name); }}><input value={adding[sec.name] || ''} onChange={e => setAdding(a => ({ ...a, [sec.name]: e.target.value }))} placeholder="Nuevo producto" aria-label={`Nuevo producto en ${sec.name}`} /><button className="primary small" aria-label={`Agregar al catálogo en ${sec.name}`}><Plus size={15} /></button></form>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
