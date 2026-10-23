import type { Category } from '../types';

/** Catálogo del súper: la lista maestra de la casa (viene de la hoja "Lista de súper" de Excel). */
export type CatalogSection = { name: string; category: Category; items: string[] };
export type CatalogRow = { id?: string; section: string; name: string; hidden?: boolean };

export const DEFAULT_CATALOG: CatalogSection[] = [
  { name: 'Fruta', category: 'Frutas y verduras', items: ['Naranjas', 'Plátano', 'Manzana', 'Fruta de temporada', 'Limón'] },
  { name: 'Verdura', category: 'Frutas y verduras', items: ['Jícama', 'Pepino', 'Zanahoria', 'Cebolla', 'Tomate', 'Chile', 'Ajo', 'Aguacate', 'Pimiento', 'Lechuga', 'Espinacas', 'Brócoli', 'Calabacitas', 'Papa', 'Chayote', 'Elote', 'Espárragos', 'Ejotes', 'Chiles para rellenar', 'Champiñones', 'Repollo'] },
  { name: 'Tortillas', category: 'Despensa', items: ['Tortillas de maíz', 'Tortillas de harina'] },
  { name: 'Carnes frías', category: 'Carnes y pescado', items: ['Jamón', 'Salchicha', 'Tocino', 'Chorizo', 'Salami', 'Carne seca'] },
  { name: 'Lácteos', category: 'Lácteos y huevos', items: ['Leche', 'Queso Oaxaca', 'Queso panela', 'Queso en cuadritos', 'Philadelphia', 'Mantequilla', 'Crema', 'Yogurt litro', 'Yogurt individual'] },
  { name: 'Carnes, aves y pescado', category: 'Carnes y pescado', items: ['Milanesa de res', 'Corte de res', 'Carne molida', 'Hígado', 'Muslos de pollo', 'Pechuga de pollo', 'Milanesa de pollo', 'Alitas de pollo', 'Carne de puerco', 'Pescado', 'Salmón', 'Marlín', 'Camarones', 'Otros mariscos'] },
  { name: 'Congelados', category: 'Despensa', items: ['Nieve', 'Fresas congeladas', 'Fruta congelada', 'Flautitas', 'Tamales', 'Verduritas congeladas'] },
  { name: 'Sopas y granos', category: 'Despensa', items: ['Arroz', 'Frijol', 'Lenteja', 'Pasta', 'Pasta para lasaña', 'Sopas', 'Garbanzo'] },
  { name: 'Bebidas y botanas', category: 'Despensa', items: ['C-Light sobres', 'Be-Light bote', 'Botellas de agua', 'Coca light mini', 'Galletas Chips Ahoy', 'Galletas Oreo', 'Galletas saladas', 'Papitas', 'Palomitas', 'Gelatina', 'Aceitunas', 'Ostiones', 'Tostadas'] },
  { name: 'Pan, cereal y harinas', category: 'Despensa', items: ['Pan Bimbo', 'Pan de hot dog', 'Redonditos', 'Pan molido', 'Crutones', 'Empanizador', 'Harina', 'Harina para hot cakes', 'Harina para pastel', 'Zucaritas', 'Special K'] },
  { name: 'Abarrotes', category: 'Despensa', items: ['Consomé', 'Knorr pollo', 'Mole', 'Puré de tomate', 'Aceite', 'Aceite de oliva', 'Pam', 'Salsa Maggi', 'Salsa de soya', 'Salsa botanera', 'Latas de verduras', 'Latas de crema', 'Atún', 'Chipotle', 'Jalapeño', 'Mayonesa', 'Mostaza dulce', 'Mostaza normal', 'Catsup', 'Aderezo Puppy Seed', 'Aderezo otro', 'Splenda', 'Azúcar', 'Café', 'Cajeta', 'Frutas en almíbar', 'Mermelada', 'Miel', 'Té', 'Vainilla', 'Vinagre'] },
  { name: 'Especias y hierbas', category: 'Despensa', items: ['Canela', 'Tajín', 'Pimienta', 'Sal'] },
  { name: 'Aseo del hogar', category: 'Limpieza y hogar', items: ['Servilletas', 'Rollo de cocina', 'Palillos', 'Popotes', 'Brasso (limpiar estufa)', 'Toallas antibacteriales', 'Fabuloso', 'Cloro (baño)', 'Madera muebles (OG)', 'Madera pisos (brillo)', 'Granito (Fabuloso/gris)', 'Ónix (trapo)', 'Acero inoxidable', 'Vidrios y espejos (Windex)', 'Jabón de platos (Axión)', 'Más Color', 'Cloro ropa', 'Más Negro', 'Jabón Zote', 'Suavitel', 'Toallas para secadora', 'Aromatizante', 'Bolsas de basura negras', 'Bolsas de basura blancas', 'Ziploc grandes', 'Ziploc chicas', 'Papel aluminio', 'Papel plástico', 'Papel encerado', 'Raid insecticida', 'Harpic (baño)'] },
  { name: 'Aseo personal', category: 'Limpieza y hogar', items: ['Shampoo Gloria', 'Enjuague Gloria', 'Shampoo Rodrigo', 'Jabón Dove', 'Jabón Gloria', 'Crema corporal', 'Desodorante Gloria', 'Desodorante Rodrigo', 'Spray', 'Gel', 'Rastrillos', 'Algodones', 'Cotonetes', 'Kleenex', 'Kotex', 'Pantyprotectores', 'Pasta dental', 'Cepillo dental', 'Enjuague bucal / hilo dental', 'Papel de baño'] },
  { name: 'Botiquín', category: 'Otros', items: ['Agua oxigenada', 'Alcohol', 'Algodón', 'Alka-Seltzer', 'Analgésicos', 'Antiácidos', 'Antigripales', 'Árnica', 'Curitas', 'Gasas', 'Merthiolate'] },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Catálogo base + lo que la familia agregó o quitó (filas guardadas en catalog_items). */
export function buildCatalog(rows: CatalogRow[] = [], base: CatalogSection[] = DEFAULT_CATALOG): CatalogSection[] {
  const hidden = new Set(rows.filter(r => r.hidden).map(r => `${norm(r.section)}|${norm(r.name)}`));
  const out: CatalogSection[] = base.map(s => ({ ...s, items: s.items.filter(i => !hidden.has(`${norm(s.name)}|${norm(i)}`)) }));
  for (const r of rows) {
    if (r.hidden || !r.name?.trim()) continue;
    const name = r.name.trim();
    let sec = out.find(s => norm(s.name) === norm(r.section));
    if (!sec) { sec = { name: r.section, category: 'Otros', items: [] }; out.push(sec); }
    if (!sec.items.some(i => norm(i) === norm(name))) sec.items.push(name);
  }
  return out;
}

/** Filtra por texto; sin texto devuelve todo. Las secciones sin coincidencias se omiten. */
export function filterCatalog(catalog: CatalogSection[], query: string): CatalogSection[] {
  const q = norm(query);
  if (!q) return catalog;
  return catalog.map(s => ({ ...s, items: s.items.filter(i => norm(i).includes(q) || norm(s.name).includes(q)) })).filter(s => s.items.length > 0);
}

const tokens = (s: string) => norm(s).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter(t => t.length > 2).map(t => t.replace(/(es|s)$/, ''));

/** ¿Algún producto de la despensa corresponde a este del catálogo? ("Leche" ↔ "Leche entera 1 LT"). */
export function haveInPantry(name: string, pantryNames: string[]): boolean {
  const need = tokens(name);
  if (!need.length) return false;
  return pantryNames.some(p => { const have = new Set(tokens(p)); return need.every(t => have.has(t)); });
}
