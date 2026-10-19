import { useState } from 'react';
import { AlertCircle, Camera, Sparkles, X } from 'lucide-react';
import { CATEGORIES, type Category, type PantryItem } from '../types';
import { UNITS, findDuplicate, mergePhotoItems, type PantryPhotoItem } from '../lib/shopping';
import { shrinkImageToBase64 } from '../lib/image';

type Row = { key: number; name: string; category: Category; qty: string; unit: string; include: boolean; sure: boolean; have: PantryItem | null };
let rowKey = 1;
const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 1; };

export default function PantryPhotoLoader({ pantry, savePantry, onDone, onClose }: {
  pantry: PantryItem[];
  savePantry: (d: any) => Promise<{ error?: string }>;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function readOne(file: File): Promise<PantryPhotoItem[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const { base64, mime } = await shrinkImageToBase64(file, 1800);
      const res = await fetch('/.netlify/functions/parse-pantry-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ imageBase64: base64, mediaType: mime }) });
      let data: any = null;
      try { data = await res.json(); } catch { /* sin JSON: normalmente el límite de tiempo de Netlify */ }
      if (!res.ok || !data) throw new Error(data?.error || 'El servidor tardó demasiado. Intenta con la foto más cerca.');
      return data.items as PantryPhotoItem[];
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw new Error('La IA tardó demasiado en esta foto.');
      if (e instanceof TypeError) throw new Error('No hay conexión con el servidor.');
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function read(list: File[]) {
    if (reading || !list.length) return;
    setReading(true); setErrors([]); setSaveError('');
    const all: PantryPhotoItem[] = []; const errs: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress(`Leyendo foto ${i + 1} de ${list.length}…`);
      try { all.push(...await readOne(list[i])); } catch (e) { errs.push(`Foto ${i + 1}: ${e instanceof Error ? e.message : 'no se pudo leer.'}`); }
    }
    const merged = mergePhotoItems(all);
    setRows(merged.map(m => {
      const have = pantry.find(p => findDuplicate([{ text: p.name, checked: false }], m.name)) ?? null;
      return { key: rowKey++, name: m.name, category: m.category, qty: String(m.quantity), unit: m.unit, include: !have, sure: m.sure, have };
    }));
    setErrors(errs); setProgress(''); setReading(false);
  }

  const patch = (key: number, p: Partial<Row>) => setRows(v => v.map(r => (r.key === key ? { ...r, ...p } : r)));
  const chosen = rows.filter(r => r.include && r.name.trim());

  async function add() {
    if (saving || !chosen.length) return;
    setSaving(true); setSaveError('');
    try {
      let n = 0;
      for (const r of chosen) {
        const res = await savePantry({ name: r.name.trim(), category: r.category, quantity: num(r.qty), unit: r.unit });
        if (res.error) { setSaveError(`Se agregaron ${n} y falló "${r.name}": ${res.error}`); return; }
        n++;
      }
      onDone(`Se agregaron ${n} productos a la despensa.`);
    } finally { setSaving(false); }
  }

  return (
    <section className="card pp-loader" aria-label="Cargar despensa con fotos">
      <div className="pp-head"><strong>Cargar con fotos</strong><button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></div>
      {rows.length === 0 && (
        <>
          <p className="muted">Toma varias fotos del refri (por repisa), del congelador y de la alacena, con buena luz y de cerca. La IA lista lo que ve y tú confirmas.</p>
          <label className="file-drop"><Camera /><span>{files.length ? `${files.length} fotos elegidas` : 'Elegir o tomar fotos'}</span>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 8))} /></label>
          {files.length > 0 && <button type="button" className="primary" disabled={reading} onClick={() => void read(files)}><Sparkles size={16} /> {reading ? progress : `Leer ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}`}</button>}
          {errors.length > 0 && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No pude leer todo</strong>{errors.map(e => <p key={e}>{e}</p>)}</div><button type="button" className="secondary small" onClick={() => void read(files)}>Reintentar</button></div>}
        </>
      )}
      {rows.length > 0 && (
        <>
          <p className="muted">Revisa la lista. Lo marcado en amarillo es una cantidad estimada: confírmala. Lo que ya tienes en la despensa viene desmarcado.</p>
          {errors.length > 0 && <div className="sl-error" role="alert"><AlertCircle size={18} /><div>{errors.map(e => <p key={e}>{e}</p>)}</div></div>}
          {rows.map(r => (
            <div className={`pp-row${r.include && !r.sure ? ' check' : ''}`} key={r.key}>
              <label className="pp-name"><input type="checkbox" checked={r.include} aria-label={`Incluir ${r.name}`} onChange={e => patch(r.key, { include: e.target.checked })} />
                <input value={r.name} aria-label="Producto" onChange={e => patch(r.key, { name: e.target.value })} /></label>
              <input value={r.qty} inputMode="decimal" aria-label={`Cantidad de ${r.name}`} onChange={e => patch(r.key, { qty: e.target.value, sure: true })} />
              <select value={r.unit} aria-label={`Unidad de ${r.name}`} onChange={e => patch(r.key, { unit: e.target.value, sure: true })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
              <select className="pp-cat" value={r.category} aria-label={`Categoría de ${r.name}`} onChange={e => patch(r.key, { category: e.target.value as Category })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              {r.have && <small className="pp-note">Ya tienes {Number(r.have.quantity)} {r.have.unit}. {r.include ? 'Se va a sumar.' : 'No se agrega.'}</small>}
              {r.include && !r.sure && <small className="pp-note">Cantidad estimada: confírmala.</small>}
            </div>
          ))}
          {saveError && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><p>{saveError}</p></div></div>}
          <button type="button" className="primary" disabled={saving || !chosen.length} onClick={() => void add()}>{saving ? 'Agregando…' : `Agregar a la despensa (${chosen.length})`}</button>
          <button type="button" className="ghost small" onClick={() => { setRows([]); setFiles([]); }}>Empezar de nuevo</button>
        </>
      )}
    </section>
  );
}
