// Lógica compartida de la lista inteligente (la usan la app y la función de Netlify).
// Es código puro: no toca Supabase, ni OpenAI, ni el navegador.
import { CATEGORIES, type Category } from '../types';

export const UNITS = ['pza', 'kg', 'g', 'L', 'ml', 'paquete', 'lata', 'bolsa', 'caja', 'docena'] as const;

export type NewGroceryRow = { name: string; category: Category; quantity: number; unit: string; source?: string };
export type AddResult = { added: number; duplicates: string[]; error?: string };
export type ShoppingItem = {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  why: string;
  /** Costo estimado TOTAL de la línea en MXN. Es una estimación de la IA, no un precio real de tienda. */
  estimated_price: number | null;
};
export type Household = { people: number | null; days: number | null; budget: number | null; store: string | null };
export type ShoppingPlan = { answer: string; items: ShoppingItem[]; estimated_total: number | null };

const strip = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ───────────── Nombres y duplicados ───────────── */

/** Formas comparables de un nombre: ignora acentos, mayúsculas, paréntesis y plurales simples. */
export function nameKeys(name: string): Set<string> {
  const base = strip(String(name || '').toLowerCase())
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = base.split(' ').filter(Boolean);
  if (!tokens.length) return new Set();
  const dropS = tokens.map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)).join(' ');
  const dropEs = tokens
    .map(t => (t.length > 4 && t.endsWith('es') ? t.slice(0, -2) : t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
    .join(' ');
  return new Set([base, dropS, dropEs]);
}

/** Devuelve el texto del producto pendiente que coincide, o null. Los ya comprados no cuentan como duplicado. */
export function findDuplicate(existing: Array<{ text: string; checked: boolean }>, name: string): string | null {
  const keys = nameKeys(name);
  if (!keys.size) return null;
  for (const item of existing) {
    if (item.checked) continue;
    const other = nameKeys(item.text);
    for (const key of keys) if (other.has(key)) return item.text;
  }
  return null;
}

/** Separa lo que se debe insertar de lo que ya estaba (incluye repetidos dentro del mismo lote). */
export function planGroceryAdds(existing: Array<{ text: string; checked: boolean }>, incoming: NewGroceryRow[]) {
  const seen = new Set<string>();
  for (const item of existing) {
    if (item.checked) continue;
    nameKeys(item.text).forEach(key => seen.add(key));
  }
  const toInsert: NewGroceryRow[] = [];
  const duplicates: string[] = [];
  for (const row of incoming) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const keys = [...nameKeys(name)];
    if (keys.some(key => seen.has(key))) {
      duplicates.push(name);
      continue;
    }
    keys.forEach(key => seen.add(key));
    toInsert.push({ ...row, name });
  }
  return { toInsert, duplicates };
}

/* ───────────── Categorías, unidades y cantidades ───────────── */

const KEYWORDS: Array<[Category, string[]]> = [
  ['Limpieza y hogar', ['jabon', 'detergente', 'cloro', 'suavizante', 'limpiador', 'desinfectante', 'servilleta', 'papel', 'shampoo', 'acondicionador', 'desodorante', 'dental', 'dientes', 'cepillo', 'esponja', 'escoba', 'trapeador', 'toalla', 'panal', 'basura', 'lavatrastes', 'fabuloso', 'pinol', 'higienico']],
  ['Lácteos y huevos', ['leche', 'huevo', 'queso', 'crema', 'yogurt', 'yogur', 'mantequilla', 'requeson', 'panela', 'oaxaca', 'margarina', 'lacteo', 'gouda', 'manchego', 'cottage']],
  ['Despensa', ['arroz', 'frijol', 'pasta', 'sopa', 'aceite', 'azucar', 'sal', 'harina', 'cafe', 'te', 'galleta', 'cereal', 'avena', 'tortilla', 'pan', 'lata', 'salsa', 'mayonesa', 'mostaza', 'catsup', 'mermelada', 'lenteja', 'garbanzo', 'jugo', 'refresco', 'agua', 'snack', 'caldo', 'pure', 'vinagre', 'chocolate', 'miel', 'nuez', 'almendra', 'cacahuate', 'tostada', 'granola', 'especia', 'pimienta', 'comino', 'oregano']],
  ['Carnes y pescado', ['pollo', 'pechuga', 'muslo', 'pierna', 'res', 'bistec', 'carne', 'molida', 'cerdo', 'chuleta', 'jamon', 'salchicha', 'tocino', 'chorizo', 'pescado', 'atun', 'salmon', 'camaron', 'tilapia', 'filete', 'arrachera', 'longaniza', 'pavo', 'costilla', 'sardina']],
  ['Frutas y verduras', ['jitomate', 'tomate', 'cebolla', 'ajo', 'chile', 'limon', 'naranja', 'manzana', 'platano', 'banana', 'aguacate', 'lechuga', 'zanahoria', 'papa', 'calabaza', 'pepino', 'espinaca', 'brocoli', 'cilantro', 'perejil', 'fresa', 'uva', 'sandia', 'melon', 'mango', 'papaya', 'verdura', 'fruta', 'elote', 'nopal', 'champinon', 'apio', 'coliflor', 'pimiento', 'pera', 'durazno', 'pina', 'chayote', 'ejote', 'betabel', 'jicama', 'mandarina', 'toronja', 'kiwi', 'arandano', 'esparrago']],
];

export function guessCategory(name: string): Category {
  const tokens = strip(String(name || '').toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const [category, words] of KEYWORDS) {
    const set = new Set(words);
    for (const token of tokens) {
      const candidates = [token];
      if (token.length > 3 && token.endsWith('s')) candidates.push(token.slice(0, -1));
      if (token.length > 4 && token.endsWith('es')) candidates.push(token.slice(0, -2));
      if (candidates.some(candidate => set.has(candidate))) return category;
    }
  }
  return 'Otros';
}

export function normalizeCategory(value: unknown, name: string): Category {
  return CATEGORIES.includes(value as Category) ? (value as Category) : guessCategory(name);
}

const UNIT_ALIASES: Record<string, string> = {
  pza: 'pza', pzas: 'pza', pieza: 'pza', piezas: 'pza', unidad: 'pza', unidades: 'pza', u: 'pza',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  paquete: 'paquete', paquetes: 'paquete', pqte: 'paquete',
  lata: 'lata', latas: 'lata',
  bolsa: 'bolsa', bolsas: 'bolsa',
  caja: 'caja', cajas: 'caja',
  docena: 'docena', docenas: 'docena',
};

export function normalizeUnit(value: unknown): string {
  const key = strip(String(value ?? '').toLowerCase().trim()).replace(/\./g, '');
  return UNIT_ALIASES[key] ?? 'pza';
}

export function normalizeQuantity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(999, Math.round(n * 100) / 100);
}

/* ───────────── Respuesta de la IA → lista segura ───────────── */

function toPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Limpia lo que devuelve la IA: sin vacíos, sin repetidos, categorías/unidades válidas, máximo 40 productos. */
export function normalizeShoppingResponse(data: unknown): ShoppingPlan {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const seen = new Set<string>();
  const items: ShoppingItem[] = [];
  for (const raw of rawItems) {
    const obj = (typeof raw === 'string' ? { name: raw } : raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = String(obj.name ?? obj.item ?? obj.producto ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) continue;
    const keys = [...nameKeys(name)];
    if (keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key));
    items.push({
      name,
      category: normalizeCategory(obj.category, name),
      quantity: normalizeQuantity(obj.quantity),
      unit: normalizeUnit(obj.unit),
      why: String(obj.why ?? '').trim().slice(0, 140),
      estimated_price: toPrice(obj.estimated_price ?? obj.price),
    });
    if (items.length >= 40) break;
  }
  const priced = items.filter(item => item.estimated_price !== null);
  const estimated_total = priced.length ? Math.round(priced.reduce((sum, item) => sum + (item.estimated_price || 0), 0)) : null;
  return { answer: typeof source.answer === 'string' ? source.answer.trim() : '', items, estimated_total };
}

/* ───────────── Interpretar la solicitud del usuario ───────────── */

const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30,
};
const NUM = '(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta)';

function wordToNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUMBERS[token] ?? null;
}

function parseMoney(raw: string, thousands: boolean): number | null {
  const clean = raw.replace(/[.,]+$/, '').replace(/,/g, '');
  const n = Number(clean);
  if (!Number.isFinite(n) || n <= 0) return null;
  return thousands ? n * 1000 : n;
}

const STORES: Array<[RegExp, string]> = [
  [/\bheb\b/, 'HEB'], [/\bcostco\b/, 'Costco'], [/\bwalmart\b/, 'Walmart'], [/\bsoriana\b/, 'Soriana'],
  [/\bcalimax\b/, 'Calimax'], [/\bcalii\b/, 'Calii'], [/\bsam'?s\b/, "Sam's"], [/\bchedraui\b/, 'Chedraui'],
  [/\bla comer\b/, 'La Comer'], [/\baurrera\b/, 'Bodega Aurrera'],
];

/** Detecta personas, días, presupuesto y tienda en una frase como "lista para HEB, cuatro personas, siete días, $2,500". */
export function parseShoppingRequest(text: string): Household {
  const t = strip(String(text || '').toLowerCase());
  const out: Household = { people: null, days: null, budget: null, store: null };

  const people = t.match(new RegExp(`\\b${NUM}\\s+(?:personas?|integrantes|comensales|adultos?|miembros)\\b`))
    || t.match(new RegExp(`familia\\s+de\\s+${NUM}\\b`));
  if (people) out.people = wordToNumber(people[1]);
  else if (/\bpareja\b/.test(t)) out.people = 2;

  const days = t.match(new RegExp(`\\b${NUM}\\s+dias?\\b`));
  const weeks = t.match(new RegExp(`\\b${NUM}\\s+semanas?\\b`));
  const months = t.match(new RegExp(`\\b${NUM}\\s+mes(?:es)?\\b`));
  if (days) out.days = wordToNumber(days[1]);
  else if (weeks) { const n = wordToNumber(weeks[1]); out.days = n ? n * 7 : null; }
  else if (months) { const n = wordToNumber(months[1]); out.days = n ? n * 30 : null; }
  else if (/\bquincena\b/.test(t)) out.days = 15;
  else if (/\bsemana\b/.test(t)) out.days = 7;

  const money =
    t.match(/\$\s*([\d][\d.,]*)(\s*mil\b)?/)
    || t.match(/presupuesto\s*(?:maximo\s*)?(?:de|:)?\s*\$?\s*([\d][\d.,]*)(\s*mil\b)?/)
    || t.match(/([\d][\d.,]*)\s*(?:pesos|mxn)\b/)
    || t.match(/\b(?:por|de|con)\s+([\d][\d.,]*)\s*(mil)\b/);
  if (money) {
    const value = parseMoney(money[1], Boolean(money[2]));
    if (value && value >= 50) out.budget = value;
  }

  for (const [pattern, label] of STORES) {
    if (pattern.test(t)) { out.store = label; break; }
  }
  return out;
}

export function formatHousehold(h: Household): string[] {
  const chips: string[] = [];
  if (h.store) chips.push(h.store);
  if (h.people) chips.push(`${h.people} ${h.people === 1 ? 'persona' : 'personas'}`);
  if (h.days) chips.push(`${h.days} ${h.days === 1 ? 'día' : 'días'}`);
  if (h.budget) chips.push(`Presupuesto ${moneyApprox(h.budget)}`);
  return chips;
}

export const moneyApprox = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value || 0);

/* ───────────── Errores de base de datos ───────────── */

export function friendlyDbError(error: unknown): string {
  const e = (error && typeof error === 'object' ? error : {}) as { message?: string; code?: string };
  const message = String(e.message ?? (typeof error === 'string' ? error : '') ?? '');
  const code = String(e.code ?? '');
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'Supabase rechazó el guardado por permisos. Cierra sesión, vuelve a entrar y reintenta.';
  }
  if (/jwt|token|not authenticated|expired/i.test(message)) {
    return 'Tu sesión expiró. Cierra sesión, vuelve a entrar y reintenta.';
  }
  if (code === '23514') return 'Alguna categoría no es válida para la base de datos.';
  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(message)) {
    return 'Falta actualizar la base de datos: ejecuta supabase/schema.sql completo en el SQL Editor de Supabase.';
  }
  if (/failed to fetch|network|load failed|fetch failed/i.test(message)) {
    return 'No hay conexión con Supabase. Revisa tu internet y reintenta.';
  }
  return `No se pudo guardar en Compras: ${message || 'error desconocido'}`;
}

/* ───────────── Recetas: ingredientes ↔ texto ───────────── */

export type ParsedIngredient = { name: string; quantity: number; unit: string; category: Category };

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67 };
// Medidas de cocina: no son cómo se compra, así que se compra 1 pieza del producto.
const COOKING_MEASURES = new Set(['taza', 'tazas', 'cucharada', 'cucharadas', 'cda', 'cdas', 'cucharadita', 'cucharaditas', 'cdita', 'cditas', 'pizca', 'pizcas', 'diente', 'dientes', 'rebanada', 'rebanadas', 'hoja', 'hojas', 'rama', 'ramas', 'ramita', 'ramitas', 'manojo', 'manojos', 'puno', 'cubo', 'cubos', 'filete', 'filetes', 'tira', 'tiras']);

function parseLeadingNumber(token: string): number | null {
  if (FRACTIONS[token] !== undefined) return FRACTIONS[token];
  const mixed = token.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]];
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  const n = Number(token.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Convierte "500 g pechuga de pollo", "2 aguacates", "1/2 kg tomate" o "sal" en algo que se puede comprar. */
export function parseIngredient(line: string): ParsedIngredient | null {
  const raw = String(line ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,?\s*al gusto\.?$/i, '').replace(/^[-•*]\s*/, '').trim();
  const match = cleaned.match(/^(\d+\s*[½¼¾⅓⅔]|\d+\/\d+|[½¼¾⅓⅔]|\d+(?:[.,]\d+)?)\s*(.*)$/);
  let quantity = 1;
  let unit = 'pza';
  let rest = cleaned;
  if (match) {
    const n = parseLeadingNumber(match[1].replace(/\s+/g, ''));
    rest = match[2].trim();
    if (n !== null) {
      quantity = n;
      const [first, ...others] = rest.split(' ');
      const key = strip(first.toLowerCase()).replace(/\./g, '');
      if (COOKING_MEASURES.has(key)) {
        quantity = 1;
        rest = others.join(' ').replace(/^de\s+/i, '').trim();
      } else if (UNIT_ALIASES[key] && UNIT_ALIASES[key] !== 'pza') {
        unit = UNIT_ALIASES[key];
        rest = others.join(' ').replace(/^de\s+/i, '').trim();
      }
    }
  }
  const name = rest.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  return { name: display.slice(0, 80), quantity: normalizeQuantity(quantity), unit, category: guessCategory(name) };
}

const trimNumber = (n: number) => String(Math.round(n * 100) / 100);

/** Inverso de parseIngredient: texto que se guarda en la receta. */
export function formatIngredient(i: { name: string; quantity: number; unit: string }): string {
  const q = trimNumber(i.quantity);
  return i.unit && i.unit !== 'pza' ? `${q} ${i.unit} ${i.name}` : `${q} ${i.name}`;
}

/* ───────────── Respuesta de la IA → recetas seguras ───────────── */

export type GeneratedRecipe = {
  name: string;
  why: string;
  servings: number;
  prep_minutes: number;
  /** Costo total estimado en MXN. Estimación de la IA, no precio real de tienda. */
  estimated_cost: number | null;
  tags: string[];
  fits: string;
  ingredients: string[];
  steps: string[];
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

export function normalizeRecipesResponse(data: unknown): { answer: string; recipes: GeneratedRecipe[] } {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const raw = Array.isArray(source.recipes) ? source.recipes : [];
  const recipes: GeneratedRecipe[] = [];
  const names = new Set<string>();
  for (const entry of raw) {
    const r = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const name = String(r.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (!name || names.has(name.toLowerCase())) continue;
    const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
      .map(i => {
        if (typeof i === 'string') {
          const parsed = parseIngredient(i);
          return parsed ? formatIngredient(parsed) : '';
        }
        const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
        const n = String(o.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        return n ? formatIngredient({ name: n, quantity: normalizeQuantity(o.quantity), unit: normalizeUnit(o.unit) }) : '';
      })
      .filter(Boolean)
      .slice(0, 25);
    const steps = (Array.isArray(r.steps) ? r.steps : [])
      .map(s => String(s ?? '').replace(/^\s*\d+[.)]\s*/, '').trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 10);
    if (!ingredients.length || !steps.length) continue;
    names.add(name.toLowerCase());
    recipes.push({
      name,
      why: String(r.why ?? '').trim().slice(0, 160),
      servings: clampInt(r.servings, 1, 20, 4),
      prep_minutes: clampInt(r.prep_minutes, 1, 240, 30),
      estimated_cost: toPrice(r.estimated_cost),
      tags: (Array.isArray(r.tags) ? r.tags : []).map(t => String(t).trim().toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 5),
      fits: String(r.fits ?? '').trim().slice(0, 200),
      ingredients,
      steps,
    });
    if (recipes.length >= 5) break;
  }
  return { answer: typeof source.answer === 'string' ? source.answer.trim() : '', recipes };
}

export const stepsToNotes = (steps: string[]) => steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

export function friendlyPhotoError(error: unknown): string {
  const e = (error && typeof error === 'object' ? error : {}) as { message?: string; statusCode?: string };
  const message = String(e.message ?? (typeof error === 'string' ? error : '') ?? '');
  if (/bucket not found|not found/i.test(message)) return 'Falta ejecutar el SQL de fotos en Supabase (archivo supabase/update_v8_6_fotos.sql).';
  if (/row-level security|permission|unauthorized|not allowed/i.test(message)) return 'Supabase rechazó subir la foto por permisos. Cierra sesión, vuelve a entrar y reintenta.';
  if (/payload too large|exceeded the maximum/i.test(message)) return 'La foto pesa demasiado para guardarse.';
  return friendlyDbError(error).replace('No se pudo guardar en Compras', 'No se pudo guardar la foto');
}
