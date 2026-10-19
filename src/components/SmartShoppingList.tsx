import { useState } from 'react';
import { AlertCircle, Check, Info, ShoppingCart } from 'lucide-react';
import { CATEGORIES, type GroceryItem } from '../types';
import {
  UNITS,
  findDuplicate,
  formatHousehold,
  friendlyDbError,
  moneyApprox,
  type AddResult,
  type Household,
  type NewGroceryRow,
  type ShoppingItem,
} from '../lib/shopping';

type Row = ShoppingItem & { id: number; selected: boolean; added: boolean; baseQty: number };

type Props = {
  items: ShoppingItem[];
  answer: string;
  household: Household;
  groceries: GroceryItem[];
  onAdd: (rows: NewGroceryRow[]) => Promise<AddResult>;
  onViewList: () => void;
};

export default function SmartShoppingList({ items, answer, household, groceries, onAdd, onViewList }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item, id) => ({ ...item, id, baseQty: item.quantity, added: false, selected: !findDuplicate(groceries, item.name) })),
  );
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);

  const statusOf = (row: Row): 'added' | 'duplicate' | 'ready' =>
    row.added ? 'added' : findDuplicate(groceries, row.name) ? 'duplicate' : 'ready';

  // El precio estimado se ajusta si cambias la cantidad.
  const priceOf = (row: Row): number | null => {
    if (row.estimated_price === null) return null;
    const qty = row.quantity > 0 ? row.quantity : row.baseQty;
    return Math.round((row.estimated_price * qty) / (row.baseQty || 1));
  };

  const selectable = rows.filter(row => statusOf(row) === 'ready');
  const chosen = selectable.filter(row => row.selected);
  const allSelected = selectable.length > 0 && chosen.length === selectable.length;
  const chosenTotal = chosen.reduce((sum, row) => sum + (priceOf(row) || 0), 0);
  const hasPrices = rows.some(row => row.estimated_price !== null);
  const budget = household.budget;
  const overBudget = budget !== null && chosenTotal > budget;
  const chips = formatHousehold(household);
  const addedCount = rows.filter(row => row.added).length;

  const patch = (id: number, changes: Partial<Row>) => setRows(prev => prev.map(row => (row.id === id ? { ...row, ...changes } : row)));
  const toggleAll = () => setRows(prev => prev.map(row => (statusOf(row) === 'ready' ? { ...row, selected: !allSelected } : row)));

  async function add() {
    if (!chosen.length || adding) return;
    setAdding(true);
    setResult(null);
    const ids = new Set(chosen.map(row => row.id));
    try {
      const response = await onAdd(
        chosen.map(row => ({ name: row.name, category: row.category, quantity: row.quantity > 0 ? row.quantity : 1, unit: row.unit, source: 'ai' })),
      );
      setResult(response);
      if (!response.error) {
        const skipped = new Set(response.duplicates);
        setRows(prev => prev.map(row => (ids.has(row.id) && !skipped.has(row.name.trim()) ? { ...row, added: true, selected: false } : row)));
      }
    } catch (error) {
      setResult({ added: 0, duplicates: [], error: friendlyDbError(error) });
    } finally {
      setAdding(false);
    }
  }

  const summary = (r: AddResult) => {
    if (r.added > 0) {
      const base = `Se ${r.added === 1 ? 'agregó 1 producto' : `agregaron ${r.added} productos`} a Compras.`;
      return r.duplicates.length ? `${base} ${r.duplicates.length === 1 ? '1 ya estaba' : `${r.duplicates.length} ya estaban`} en tu lista.` : base;
    }
    return 'Esos productos ya estaban en tu lista de Compras.';
  };

  return (
    <div className="card sl-card">
      <div className="sl-head">
        <h3>Tu lista propuesta</h3>
        {answer && <p className="assistant-answer">{answer}</p>}
        {chips.length > 0 && <div className="sl-chips">{chips.map(chip => <span key={chip}>{chip}</span>)}</div>}
      </div>

      {hasPrices && (
        <div className={`sl-estimate ${overBudget ? 'over' : ''}`}>
          <div className="sl-estimate-row">
            <strong>≈ {moneyApprox(chosenTotal)}</strong>
            <span>{budget !== null ? `de ${moneyApprox(budget)} de presupuesto` : 'estimado de lo seleccionado'}</span>
          </div>
          {budget !== null && (
            <div className="sl-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (chosenTotal / budget) * 100)}%` }} /></div>
          )}
          {overBudget && <p className="sl-warn">Con lo seleccionado se pasa del presupuesto por aproximadamente {moneyApprox(chosenTotal - (budget as number))}.</p>}
          <p className="sl-note"><Info size={14} />Precios estimados por la IA, no son precios reales de {household.store || 'la tienda'}.</p>
        </div>
      )}

      <div className="sl-toolbar">
        <button type="button" className="secondary small" onClick={toggleAll} disabled={selectable.length === 0}>
          {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
        </button>
        <span>{chosen.length} de {rows.length} seleccionados{addedCount > 0 ? ` · ${addedCount} agregados` : ''}</span>
      </div>

      {CATEGORIES.map(category => {
        const group = rows.filter(row => row.category === category);
        if (!group.length) return null;
        return (
          <section className="sl-group" key={category}>
            <h4>{category}</h4>
            <ul>
              {group.map(row => {
                const status = statusOf(row);
                const checked = status === 'added' || (status === 'ready' && row.selected);
                const price = priceOf(row);
                const units = (UNITS as readonly string[]).includes(row.unit) ? [...UNITS] : [...UNITS, row.unit];
                return (
                  <li key={row.id} className={`sl-row ${checked ? 'selected' : ''} ${status !== 'ready' ? 'locked' : ''}`}>
                    <button
                      type="button"
                      className="sl-check"
                      disabled={status !== 'ready'}
                      aria-pressed={checked}
                      aria-label={`${checked ? 'Quitar' : 'Seleccionar'} ${row.name}`}
                      onClick={() => patch(row.id, { selected: !row.selected })}
                    >
                      {checked && <Check size={16} />}
                    </button>
                    <div className="sl-name">
                      <strong>{row.name}</strong>
                      {status === 'duplicate' && <em className="sl-badge">Ya está en Compras</em>}
                      {status === 'added' && <em className="sl-badge ok">Agregado</em>}
                      {status === 'ready' && row.why && <span>{row.why}</span>}
                    </div>
                    <div className="sl-qty">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        aria-label={`Cantidad de ${row.name}`}
                        value={row.quantity > 0 ? row.quantity : ''}
                        disabled={status !== 'ready'}
                        onChange={event => patch(row.id, { quantity: Number(event.target.value) })}
                      />
                      <select
                        aria-label={`Unidad de ${row.name}`}
                        value={row.unit}
                        disabled={status !== 'ready'}
                        onChange={event => patch(row.id, { unit: event.target.value })}
                      >
                        {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    <span className="sl-price">{price === null ? '—' : `≈ ${moneyApprox(price)}`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {result?.error && (
        <div className="sl-error" role="alert">
          <AlertCircle size={18} />
          <div><strong>No se pudo guardar</strong><p>{result.error}</p></div>
          <button type="button" className="secondary small" onClick={add} disabled={adding || chosen.length === 0}>Reintentar</button>
        </div>
      )}
      {result && !result.error && (
        <div className="ai-notice" role="status">
          <Check size={18} />{summary(result)}
          {result.added > 0 && <button type="button" className="ghost small" onClick={onViewList}>Ver Compras</button>}
        </div>
      )}

      <div className="sl-footer">
        <button type="button" className="primary" disabled={chosen.length === 0 || adding} onClick={add}>
          <ShoppingCart size={18} />
          {adding ? 'Agregando…' : `Agregar seleccionados a Compras (${chosen.length})`}
        </button>
      </div>
    </div>
  );
}
