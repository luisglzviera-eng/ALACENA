import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { compareWithCatalog, type CatalogSection } from '../lib/catalog';
import type { AddResult, NewGroceryRow } from '../lib/shopping';

/** Resumen "lista de la IA vs. mi catálogo": qué ya es habitual, qué es nuevo y qué del catálogo faltó. */
export default function CatalogCompare({ names, catalog, pantryNames, onAdd }: {
  names: string[]; catalog: CatalogSection[]; pantryNames: string[]; onAdd: (rows: NewGroceryRow[]) => Promise<AddResult>;
}) {
  const cmp = useMemo(() => compareWithCatalog(names, catalog, pantryNames), [names, catalog, pantryNames]);
  if (!cmp.total) return null;
  return (
    <section className="card cat-compare" aria-label="Comparación con tu catálogo">
      <h3>Comparado con tu catálogo</h3>
      <ul className="cat-sum">
        <li><b>{cmp.inCatalog.length}</b> de {cmp.total} productos ya son de tu catálogo</li>
        <li><b>{cmp.isNew.length}</b> son nuevos (no están en tu catálogo)</li>
        <li><b>{cmp.missingCount}</b> de tu catálogo no entraron en la lista{cmp.inPantryCount ? ` (y ${cmp.inPantryCount} más ya los tienes en la despensa)` : ''}</li>
      </ul>
      {cmp.isNew.length > 0 && <details><summary>Ver los nuevos</summary><div className="cat-chips">{cmp.isNew.map(n => <span className="cat-chip" key={n}>{n}</span>)}</div></details>}
      {cmp.missing.length > 0 && (
        <details>
          <summary>Ver lo que no incluí de tu catálogo</summary>
          {cmp.missing.map(sec => (
            <div key={sec.section}>
              <strong className="cat-mini">{sec.section}</strong>
              <div className="cat-chips">{sec.items.map(n => <button type="button" className="cat-chip" key={n} aria-label={`Agregar ${n} a la lista`} onClick={() => void onAdd([{ name: n, category: sec.category, quantity: 1, unit: 'pza', source: 'catalog' }])}><Plus size={13} />{n}</button>)}</div>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
