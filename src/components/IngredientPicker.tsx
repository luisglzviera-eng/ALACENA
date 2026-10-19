import { useState } from 'react';
import { AlertCircle, Check, ShoppingCart } from 'lucide-react';
import type { GroceryItem, PantryItem } from '../types';
import { QtyField } from './SmartShoppingList';
import { findDuplicate, friendlyDbError, parseIngredient, type AddResult, type NewGroceryRow, type ParsedIngredient } from '../lib/shopping';

type Row = ParsedIngredient & { id: number; selected: boolean; added: boolean; original: string };

type Props = {
  ingredients: string[];
  groceries: GroceryItem[];
  pantry: PantryItem[];
  onAdd: (rows: NewGroceryRow[]) => Promise<AddResult>;
  onViewList: () => void;
};

/** Elegir qué ingredientes de una receta se agregan a Compras. Marca lo que ya está en la lista o en la despensa. */
export default function IngredientPicker({ ingredients, groceries, pantry, onAdd, onViewList }: Props) {
  const stocked = pantry.filter(p => Number(p.quantity) > 0).map(p => ({ text: p.name, checked: false }));
  const inPantry = (name: string) => Boolean(findDuplicate(stocked, name));
  const [rows, setRows] = useState<Row[]>(() =>
    ingredients
      .map((original, id) => ({ parsed: parseIngredient(original), original, id }))
      .filter((x): x is { parsed: ParsedIngredient; original: string; id: number } => x.parsed !== null)
      .map(x => ({ ...x.parsed, id: x.id, original: x.original, added: false, selected: !findDuplicate(groceries, x.parsed.name) && !inPantry(x.parsed.name) })),
  );
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);

  const statusOf = (row: Row): 'added' | 'duplicate' | 'pantry' | 'ready' =>
    row.added ? 'added' : findDuplicate(groceries, row.name) ? 'duplicate' : inPantry(row.name) ? 'pantry' : 'ready';
  const selectable = rows.filter(r => ['ready', 'pantry'].includes(statusOf(r)));
  const chosen = selectable.filter(r => r.selected);
  const allSelected = selectable.length > 0 && chosen.length === selectable.length;
  const patch = (id: number, changes: Partial<Row>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...changes } : r)));

  async function add() {
    if (!chosen.length || adding) return;
    setAdding(true);
    setResult(null);
    const ids = new Set(chosen.map(r => r.id));
    try {
      const response = await onAdd(chosen.map(r => ({ name: r.name, category: r.category, quantity: r.quantity, unit: r.unit, source: 'recipe' })));
      setResult(response);
      if (!response.error) {
        const skipped = new Set(response.duplicates);
        setRows(prev => prev.map(r => (ids.has(r.id) && !skipped.has(r.name.trim()) ? { ...r, added: true, selected: false } : r)));
      }
    } catch (error) {
      setResult({ added: 0, duplicates: [], error: friendlyDbError(error) });
    } finally {
      setAdding(false);
    }
  }

  const summary = (r: AddResult) =>
    r.added > 0
      ? `Se ${r.added === 1 ? 'agregó 1 ingrediente' : `agregaron ${r.added} ingredientes`} a Compras.${r.duplicates.length ? ` ${r.duplicates.length} ya estaban en tu lista.` : ''}`
      : 'Esos ingredientes ya estaban en tu lista de Compras.';

  if (!rows.length) return <p className="muted">Esta receta no tiene ingredientes que se puedan agregar.</p>;

  return (
    <div className="ing-picker">
      <div className="sl-toolbar">
        <button type="button" className="secondary small" onClick={() => setRows(prev => prev.map(r => (['ready', 'pantry'].includes(statusOf(r)) ? { ...r, selected: !allSelected } : r)))}>
          {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
        </button>
        <span>{chosen.length} de {rows.length} seleccionados</span>
      </div>
      <ul className="ing-list">
        {rows.map(row => {
          const status = statusOf(row);
          const locked = status === 'added' || status === 'duplicate';
          const checked = status === 'added' || (!locked && row.selected);
          return (
            <li key={row.id} className={`sl-row ing-row ${checked ? 'selected' : ''} ${locked ? 'locked' : ''}`}>
              <button type="button" className="sl-check" disabled={locked} aria-pressed={checked} aria-label={`${checked ? 'Quitar' : 'Seleccionar'} ${row.name}`} onClick={() => patch(row.id, { selected: !row.selected })}>
                {checked && <Check size={16} />}
              </button>
              <div className="sl-name">
                <strong>{row.name}</strong>
                {status === 'duplicate' && <em className="sl-badge">Ya está en Compras</em>}
                {status === 'pantry' && <em className="sl-badge">Ya tienes en despensa</em>}
                {status === 'added' && <em className="sl-badge ok">Agregado</em>}
              </div>
              <div className="sl-qty">
                <QtyField value={row.quantity} name={row.name} disabled={locked} onChange={n => patch(row.id, { quantity: n })} />
                <span className="ing-unit">{row.unit}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {result?.error && (
        <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No se pudo guardar</strong><p>{result.error}</p></div>
          <button type="button" className="secondary small" onClick={add} disabled={adding}>Reintentar</button></div>
      )}
      {result && !result.error && (
        <div className="ai-notice" role="status"><Check size={18} />{summary(result)}{result.added > 0 && <button type="button" className="ghost small" onClick={onViewList}>Ver Compras</button>}</div>
      )}
      <button type="button" className="primary" disabled={chosen.length === 0 || adding} onClick={add}>
        <ShoppingCart size={18} />{adding ? 'Agregando…' : `Agregar a Compras (${chosen.length})`}
      </button>
    </div>
  );
}
