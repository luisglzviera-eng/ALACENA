import { useEffect, useMemo, useState } from 'react';
import { isConfigured, supabase } from './supabase';
import { buildCatalog, type CatalogRow, type CatalogSection } from './catalog';

/** Catálogo vigente (base + lo agregado/quitado por la familia). Sin tabla en Supabase usa el catálogo base. */
export function useCatalog(): CatalogSection[] {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  useEffect(() => {
    if (!isConfigured) return;
    let live = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('catalog_items').select('*');
        if (live && !error) setRows((data || []) as CatalogRow[]);
      } catch { /* sin tabla */ }
    })();
    return () => { live = false; };
  }, []);
  return useMemo(() => buildCatalog(rows), [rows]);
}
