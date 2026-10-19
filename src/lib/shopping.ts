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
  [/\bcalii\b/, 'Calii'], [/\bsam'?s\b/, "Sam's"], [/\bchedraui\b/, 'Chedraui'],
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

/* ───────────── Despensa: caducidad y reposición ───────────── */

export const todayLocal = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export type ExpiryInfo = { state: 'none' | 'ok' | 'soon' | 'expired'; days: number | null; label: string };

/** Días que faltan para caducar (negativo = ya caducó). `soonDays` es el margen para avisar. */
export function expiryInfo(expiresOn: string | null | undefined, today = todayLocal(), soonDays = 5): ExpiryInfo {
  if (!expiresOn) return { state: 'none', days: null, label: '' };
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  const days = Math.round((toUtc(expiresOn) - toUtc(today)) / 86400000);
  if (!Number.isFinite(days)) return { state: 'none', days: null, label: '' };
  if (days < 0) return { state: 'expired', days, label: days === -1 ? 'Caducó ayer' : `Caducó hace ${-days} días` };
  if (days === 0) return { state: 'soon', days, label: 'Caduca hoy' };
  if (days === 1) return { state: 'soon', days, label: 'Caduca mañana' };
  if (days <= soonDays) return { state: 'soon', days, label: `Caduca en ${days} días` };
  return { state: 'ok', days, label: `Caduca ${expiresOn.slice(0, 10)}` };
}

/** Cuánto conviene comprar para volver a tener stock: el doble del mínimo menos lo que queda. */
export const restockQuantity = (quantity: number, lowAt: number) =>
  Math.max(1, Math.round((Number(lowAt || 1) * 2 - Number(quantity || 0)) * 100) / 100);

/** Paso razonable del botón +/− según la unidad. */
export const stepForUnit = (unit: string) => (unit === 'g' || unit === 'ml' ? 100 : unit === 'kg' || unit === 'L' ? 0.5 : 1);

/* ───────────── Menú semanal ───────────── */

export const MENU_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export const MENU_SLOTS = ['breakfast', 'lunch', 'snack', 'kids', 'dinner'] as const;
export type MenuSlot = (typeof MENU_SLOTS)[number];
export const SLOT_LABEL: Record<MenuSlot, string> = { breakfast: 'Desayuno', lunch: 'Comida', snack: 'Snack', kids: 'Lunch de la niña', dinner: 'Cena' };
export type MenuDaysMap = Record<string, Partial<Record<MenuSlot, string>>>;

/** Limpia el menú que devuelve la IA: solo los 7 días, textos cortos, sin vacíos inventados. */
export function normalizeMenuResponse(data: unknown): { answer: string; days: MenuDaysMap; filled: number } {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const raw = (source.days && typeof source.days === 'object' ? source.days : {}) as Record<string, any>;
  const days: MenuDaysMap = {};
  let filled = 0;
  for (const day of MENU_DAYS) {
    const entry = raw[day] ?? raw[strip(day)] ?? raw[day.toLowerCase()] ?? raw[strip(day).toLowerCase()] ?? {};
    const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const values: Record<MenuSlot, string> = {
      breakfast: clean(entry.breakfast ?? entry.desayuno),
      lunch: clean(entry.lunch ?? entry.comida),
      snack: clean(entry.snack ?? entry.colacion ?? entry.colación),
      kids: clean(entry.kids ?? entry.lunch_nina ?? entry.lunch_niña ?? entry.kidsLunch),
      dinner: clean(entry.dinner ?? entry.cena),
    };
    days[day] = values;
    filled += MENU_SLOTS.filter(s => values[s]).length;
  }
  return { answer: typeof source.answer === 'string' ? source.answer.trim() : '', days, filled };
}

/** Busca entre las recetas guardadas la que corresponde al texto de una comida del menú. */
export function findRecipeForMeal<T extends { name: string }>(recipes: T[], meal: string): T | null {
  const wanted = nameKeys(meal);
  if (!wanted.size) return null;
  for (const recipe of recipes) {
    const keys = nameKeys(recipe.name);
    for (const key of wanted) if (keys.has(key)) return recipe;
  }
  const text = [...wanted][0];
  if (text.length >= 5) {
    for (const recipe of recipes) {
      const rn = [...nameKeys(recipe.name)][0];
      if (rn && rn.length >= 5 && (text.includes(rn) || rn.includes(text))) return recipe;
    }
  }
  return null;
}

/** Junta ingredientes repetidos de varias recetas (2 jitomates + 3 jitomates = 5). Solo suma si la unidad coincide. */
export function mergeIngredients(list: ParsedIngredient[]): ParsedIngredient[] {
  const groups: Array<{ keys: Set<string>; item: ParsedIngredient }> = [];
  for (const item of list) {
    const keys = nameKeys(item.name);
    const found = groups.find(g => g.item.unit === item.unit && [...keys].some(k => g.keys.has(k)));
    if (found) {
      found.item.quantity = normalizeQuantity(found.item.quantity + item.quantity);
      keys.forEach(k => found.keys.add(k));
    } else groups.push({ keys: new Set(keys), item: { ...item } });
  }
  return groups.map(g => g.item);
}

export type MealSlotInfo = { day: string; slot: MenuSlot; text: string };

export function plannedMeals(days: MenuDaysMap | Record<string, any>): MealSlotInfo[] {
  const out: MealSlotInfo[] = [];
  for (const day of MENU_DAYS) {
    for (const slot of MENU_SLOTS) {
      const text = String(days?.[day]?.[slot] ?? '').trim();
      if (text) out.push({ day, slot, text });
    }
  }
  return out;
}

/* ───────────── Familia (quién vive en casa) ───────────── */

export type HouseholdKind = 'adulto' | 'niño' | 'niña' | 'bebé';
export type HouseholdMember = { id: string; name: string; kind: HouseholdKind; notes: string };
export const HOUSEHOLD_KINDS: HouseholdKind[] = ['adulto', 'niña', 'niño', 'bebé'];

export const DEFAULT_HOUSEHOLD: HouseholdMember[] = [
  { id: 'a1', name: 'Adulto 1', kind: 'adulto', notes: '' },
  { id: 'a2', name: 'Adulto 2', kind: 'adulto', notes: '' },
  { id: 'k1', name: 'Niña', kind: 'niña', notes: '' },
  { id: 'b1', name: 'Bebé', kind: 'bebé', notes: '' },
];

/** Limpia la lista guardada; si no hay nada válido usa 2 adultos, 1 niña y 1 bebé. */
export function normalizeHousehold(value: unknown): HouseholdMember[] {
  if (!Array.isArray(value)) return DEFAULT_HOUSEHOLD.map(m => ({ ...m }));
  const out: HouseholdMember[] = [];
  value.slice(0, 12).forEach((raw: any, i) => {
    const kind = HOUSEHOLD_KINDS.includes(raw?.kind) ? raw.kind : null;
    if (!kind) return;
    out.push({ id: String(raw.id || `m${i}`), name: String(raw.name ?? '').trim().slice(0, 30) || kind, kind, notes: String(raw.notes ?? '').trim().slice(0, 200) });
  });
  return out.length ? out : DEFAULT_HOUSEHOLD.map(m => ({ ...m }));
}

/** "2 adultos, 1 niña y 1 bebé" */
export function householdSummary(list: HouseholdMember[]): string {
  const count = (k: HouseholdKind) => list.filter(m => m.kind === k).length;
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => { if (n) parts.push(`${n} ${n === 1 ? one : many}`); };
  add(count('adulto'), 'adulto', 'adultos'); add(count('niña'), 'niña', 'niñas'); add(count('niño'), 'niño', 'niños'); add(count('bebé'), 'bebé', 'bebés');
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0] || '';
}

/** Personas que comen porciones normales (los bebés no cuentan para cantidades). */
export const householdPortions = (list: HouseholdMember[]) => Math.max(1, list.filter(m => m.kind !== 'bebé').length);

/* ───────────── Tickets y gasto ───────────── */

export const RECEIPT_STORES = ['HEB', 'Costco', "Sam's", 'Calii', 'Otro'] as const;
/** Categorías que NO son comida: no van a la despensa. */
export const NON_FOOD_CATEGORIES: string[] = ['Limpieza y hogar', 'Otros'];
export const isFoodCategory = (category: string) => !NON_FOOD_CATEGORIES.includes(category);
export type ReceiptItem = { name: string; category: Category; quantity: number | null; unit_price: number | null; total_price: number; is_food: boolean; unit: string;
  /** Lo que entra a la despensa (cantidad × contenido del paquete) y si hay que confirmarlo a mano. */
  pantry_quantity: number; pantry_unit: string; needs_check: boolean;
};

/** Cantidad × contenido de un paquete → cantidad para la despensa, con unidades cómodas (1000 g → 1 kg). */
export function pantryAmount(quantity: number, packSize: number | null, packUnit: string | null): { quantity: number; unit: string } {
  let q = packSize && packSize > 0 ? quantity * packSize : quantity;
  let unit = packSize && packSize > 0 ? normalizeUnit(packUnit) : 'pza';
  if (unit === 'g' && q >= 1000) { q /= 1000; unit = 'kg'; }
  if (unit === 'ml' && q >= 1000) { q /= 1000; unit = 'L'; }
  return { quantity: Math.round(q * 1000) / 1000, unit };
}
export type ReceiptRead = { store: string | null; date: string | null; items: ReceiptItem[]; total: number; itemsSum: number };

const money2 = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const NOT_A_PRODUCT = /^(sub\s?total|venta|total|iva|i\.v\.a|ieps|cambio|efectivo|tarjeta|pago|propina|descuento|ahorro|redondeo|donativo|hambre cero|articulos|art[ií]culos|folio|ticket)\b/i;

/** Limpia lo que devuelve la IA al leer un ticket: sin renglones de total/IVA/pago, precios numéricos, fecha y tienda válidas. */
export function normalizeReceiptResponse(data: unknown): ReceiptRead {
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, any>;
  const items: ReceiptItem[] = [];
  for (const raw of Array.isArray(src.items) ? src.items.slice(0, 120) : []) {
    const name = String(raw?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 70);
    if (!name || NOT_A_PRODUCT.test(name)) continue;
    const qtyRaw = raw?.quantity == null || raw.quantity === '' ? null : Number(raw.quantity);
    const quantity = qtyRaw != null && Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw * 1000) / 1000 : null;
    let unit_price: number | null = raw?.unit_price == null || raw.unit_price === '' ? null : money2(raw.unit_price);
    if (unit_price != null && unit_price <= 0) unit_price = null;
    let total_price = money2(raw?.total_price);
    if (total_price <= 0 && unit_price) total_price = money2(unit_price * (quantity ?? 1));
    if (total_price <= 0) continue; // descuentos sueltos o renglones sin precio
    let category = normalizeCategory(raw?.category, name);
    const said = raw?.is_food === false || String(raw?.is_food).toLowerCase() === 'false' ? false : raw?.is_food === true || String(raw?.is_food).toLowerCase() === 'true' ? true : null;
    // La IA manda is_food; si se contradice con la categoría, manda is_food (y la categoría se ajusta a una válida).
    if (said === false && isFoodCategory(category)) category = 'Otros';
    if (said === true && !isFoodCategory(category)) category = 'Despensa';
    const unitSaid = String(raw?.unit ?? '').trim();
    const unit = unitSaid ? normalizeUnit(unitSaid) : quantity != null && !Number.isInteger(quantity) ? 'kg' : 'pza';
    const sizeRaw = Number(raw?.pack_size);
    const packSize = Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : null;
    const weighed = unit !== 'pza';
    const amount = weighed ? { quantity: quantity ?? 1, unit } : pantryAmount(quantity ?? 1, packSize, raw?.pack_unit);
    const food = isFoodCategory(category);
    const needs_check = food && !weighed && !packSize && ['Carnes y pescado', 'Frutas y verduras'].includes(category);
    items.push({ name, category, quantity, unit, unit_price, total_price, is_food: food, pantry_quantity: amount.quantity, pantry_unit: amount.unit, needs_check });
  }
  const storeText = String(src.store ?? '').toLowerCase();
  const store = /heb|h-e-b/.test(storeText) ? 'HEB' : /costco/.test(storeText) ? 'Costco' : /\bsam.?s\b/.test(storeText) ? "Sam's" : /calii/.test(storeText) ? 'Calii' : storeText.trim() ? 'Otro' : null;
  const dateText = String(src.date ?? '').trim();
  const dm = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[3] >= 1 && +dm[3] <= 31 ? dateText : null;
  const itemsSum = money2(items.reduce((s, i) => s + i.total_price, 0));
  const total = money2(src.total) > 0 ? money2(src.total) : itemsSum;
  return { store, date, items, total, itemsSum };
}

/** ¿Ya guardaste este ticket? Misma tienda, misma fecha y mismo total. */
export function findDuplicateReceipt<T extends { store: string; purchase_date: string; total: number }>(
  purchases: T[], candidate: { store: string; date: string; total: number },
): T | null {
  return purchases.find(p => p.store === candidate.store && p.purchase_date === candidate.date && Math.abs(Number(p.total) - candidate.total) < 0.01) ?? null;
}

export type MonthReport = {
  month: string; total: number; count: number; average: number;
  byStore: Array<{ name: string; value: number }>;
  byCategory: Array<{ name: string; value: number }>;
  topItems: Array<{ name: string; value: number; times: number }>;
  food: number; nonFood: number;
};

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Resumen de gasto de un mes ("2026-10"): por tienda, por categoría y los productos donde más se va. */
export function monthReport(
  purchases: Array<{ store: string; purchase_date: string; total: number; purchase_items?: Array<{ name: string; category: string; total_price: number }> }>,
  month: string,
): MonthReport {
  const list = purchases.filter(p => String(p.purchase_date).startsWith(month));
  const sum = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);
  const stores = new Map<string, number>(), cats = new Map<string, number>();
  let food = 0, nonFood = 0;
  const prods: Array<{ keys: Set<string>; name: string; value: number; times: number }> = [];
  for (const p of list) {
    sum(stores, p.store || 'Otro', Number(p.total));
    for (const it of p.purchase_items || []) {
      sum(cats, it.category || 'Otros', Number(it.total_price));
      if (isFoodCategory(it.category || 'Otros')) food += Number(it.total_price); else nonFood += Number(it.total_price);
      const keys = nameKeys(it.name);
      let cur = prods.find(x => [...keys].some(k => x.keys.has(k)));
      if (!cur) { cur = { keys: new Set(keys), name: it.name, value: 0, times: 0 }; prods.push(cur); } else keys.forEach(k => cur!.keys.add(k));
      cur.value += Number(it.total_price); cur.times += 1;
    }
  }
  const rank = (m: Map<string, number>) => [...m].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  const total = Math.round(list.reduce((s, p) => s + Number(p.total), 0) * 100) / 100;
  return {
    food: Math.round(food * 100) / 100, nonFood: Math.round(nonFood * 100) / 100,
    month, total, count: list.length, average: list.length ? Math.round((total / list.length) * 100) / 100 : 0,
    byStore: rank(stores), byCategory: rank(cats),
    topItems: prods.map(p => ({ name: p.name, times: p.times, value: Math.round(p.value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5),
  };
}
