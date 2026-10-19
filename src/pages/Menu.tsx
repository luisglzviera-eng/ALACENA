import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Archive, BookOpen, Check, Copy, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Page } from '../components/UI';
import SmartShoppingList from '../components/SmartShoppingList';
import {
  MENU_DAYS, MENU_SLOTS, householdPortions, householdSummary, normalizeHousehold, SLOT_LABEL, expiryInfo, findDuplicate, findRecipeForMeal, mergeIngredients, normalizeShoppingResponse, parseIngredient, plannedMeals,
  type MenuDaysMap, type MenuSlot, type ParsedIngredient, type ShoppingItem,
} from '../lib/shopping';
import type { MenuWeek, Recipe } from '../types';

type Slot = MenuSlot;
const MEAL_TYPE: Record<Slot, string> = { breakfast: 'desayuno', lunch: 'comida normal', snack: 'snack', kids: 'para niños', dinner: 'cena ligera' };
type Notice = { tone: 'ok' | 'error'; text: string };

async function postJSON(url: string, body: unknown, ms = 32000): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify(body) });
    let data: any = null;
    try { data = await response.json(); } catch { /* sin JSON: normalmente el límite de tiempo de Netlify */ }
    return { ok: response.ok && data !== null, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}
const networkMessage = (error: unknown, what: string) =>
  error instanceof DOMException && error.name === 'AbortError' ? `La IA tardó demasiado en ${what}. Intenta de nuevo.` : 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';

/* ───────── Selector de una comida: mis recetas + ideas con IA ───────── */
function SlotPicker({ day, slot, recipes, onPick, onClose, context }: { day: string; slot: Slot; recipes: Recipe[]; onPick: (name: string) => void; onClose: () => void; context: () => Record<string, unknown> }) {
  const [query, setQuery] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const list = recipes.filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);

  async function askIdeas() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await postJSON('/.netlify/functions/suggest-recipes', { ...context(), mealType: MEAL_TYPE[slot] });
      if (!res.ok) throw new Error(res.data?.error || 'La IA tardó demasiado en responder.');
      const names = (Array.isArray(res.data.suggestions) ? res.data.suggestions : []).map((x: any) => String(x?.name ?? x).trim()).filter(Boolean).slice(0, 8);
      if (!names.length) throw new Error('La IA no devolvió ideas. Intenta de nuevo.');
      setIdeas(names);
    } catch (e) {
      setError(e instanceof Error && !(e instanceof TypeError) && !(e instanceof DOMException) ? e.message : networkMessage(e, 'responder'));
    } finally { setLoading(false); }
  }

  return (
    <div className="mn-picker" role="group" aria-label={`Elegir ${SLOT_LABEL[slot].toLowerCase()} del ${day}`}>
      <div className="mn-picker-head"><strong>{SLOT_LABEL[slot]} del {day}</strong><button type="button" className="icon-btn" aria-label="Cerrar selector" onClick={onClose}><X size={16} /></button></div>
      {recipes.length > 0 && (
        <>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en mis recetas…" aria-label="Buscar en mis recetas" />
          <div className="mn-chips">{list.map(r => <button type="button" key={r.id} onClick={() => onPick(r.name)}>{r.name}</button>)}{list.length === 0 && <small>No hay recetas con ese nombre.</small>}</div>
        </>
      )}
      <button type="button" className="secondary small" disabled={loading} onClick={() => void askIdeas()}><Sparkles size={15} />{loading ? 'Pensando…' : 'Ideas con IA'}</button>
      {ideas.length > 0 && <div className="mn-chips">{ideas.map(name => <button type="button" key={name} onClick={() => onPick(name)}>{name}</button>)}</div>}
      {error && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><p>{error}</p></div><button type="button" className="secondary small" onClick={() => void askIdeas()}>Reintentar</button></div>}
    </div>
  );
}

export default function Menu() {
  const navigate = useNavigate();
  const { weeks, recipes, pantry, groceries, preferences, updateMeal, saveWeekDays, archiveWeek, addGroceryBatch } = useApp();
  const active = weeks.find(w => !w.archived);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<{ day: string; slot: Slot } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const household = useMemo(() => normalizeHousehold(preferences.household), [preferences.household]);
  const people = householdPortions(household);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPlan, setAiPlan] = useState<{ days: MenuDaysMap; answer: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSlots, setAiSlots] = useState<Slot[]>([...MENU_SLOTS]);

  const [shopLoading, setShopLoading] = useState(false);
  const [shop, setShop] = useState<{ key: number; items: ShoppingItem[]; notes: string[] } | null>(null);
  const [shopCount, setShopCount] = useState(0);

  const archived = useMemo(() => weeks.filter(w => w.archived), [weeks]);
  const valueOf = (day: string, slot: Slot) => drafts[`${day}|${slot}`] ?? active?.days[day]?.[slot] ?? '';
  const planned = active ? plannedMeals(active.days) : [];
  const stockedPantry = pantry.filter(p => Number(p.quantity) > 0).map(p => ({ text: p.name, checked: false }));

  const aiContext = () => ({
    recipes: recipes.slice(0, 30).map(r => ({ name: r.name })),
    recentMeals: [...planned.map(m => m.text), ...archived.slice(0, 4).flatMap(w => plannedMeals(w.days).map(m => m.text))].slice(0, 30),
    preferences,
  });

  async function commit(day: string, slot: Slot, value: string) {
    const key = `${day}|${slot}`;
    const clean = value.trim();
    if (clean === (active?.days[day]?.[slot] ?? '')) { setDrafts(d => { const { [key]: _x, ...rest } = d; return rest; }); return; }
    const { error } = await updateMeal(day, slot, clean);
    if (error) return setNotice({ tone: 'error', text: error });
    setDrafts(d => { const { [key]: _x, ...rest } = d; return rest; });
  }

  async function pick(name: string) {
    if (!picker) return;
    const { day, slot } = picker;
    setPicker(null);
    setDrafts(d => ({ ...d, [`${day}|${slot}`]: name }));
    await commit(day, slot, name);
  }

  async function generateWeek() {
    if (aiLoading || !active) return;
    setAiLoading(true); setAiError(''); setAiPlan(null);
    try {
      const res = await postJSON('/.netlify/functions/generate-menu', {
        prompt: aiPrompt.trim(), people, slots: aiSlots, household: household.map(({ name, kind, notes }) => ({ name, kind, notes })),
        preferences: { diet_user: preferences.diet_user, diet_partner: preferences.diet_partner, kids_recipes: preferences.kids_recipes, budget_priority: preferences.budget_priority },
        savedRecipes: recipes.slice(0, 40).map(r => ({ name: r.name })),
        pantry: stockedPantry.slice(0, 50).map(p => ({ name: p.text })),
        expiring: pantry.filter(p => ['soon', 'expired'].includes(expiryInfo(p.expires_on).state)).map(p => ({ name: p.name })),
        keep: planned.map(m => m.text),
      });
      if (!res.ok) throw new Error(res.data?.error || 'El servidor tardó demasiado en responder. Intenta de nuevo.');
      setAiPlan({ days: res.data.days, answer: res.data.answer || '' });
    } catch (e) {
      setAiError(e instanceof Error && !(e instanceof TypeError) && !(e instanceof DOMException) ? e.message : networkMessage(e, 'armar el menú'));
    } finally { setAiLoading(false); }
  }

  async function applyPlan(mode: 'empty' | 'all') {
    if (!aiPlan || !active) return;
    const next: MenuDaysMap = {};
    let changed = 0;
    for (const day of MENU_DAYS) {
      next[day] = { ...(active.days[day] || {}), lunch: active.days[day]?.lunch ?? '', dinner: active.days[day]?.dinner ?? '' };
      for (const slot of MENU_SLOTS) {
        const suggestion = aiPlan.days[day]?.[slot] ?? '';
        const current = next[day][slot] ?? '';
        if (suggestion && (mode === 'all' || !current)) { if (current !== suggestion) changed++; next[day][slot] = suggestion; }
      }
    }
    const { error } = await saveWeekDays(next);
    if (error) return setNotice({ tone: 'error', text: error });
    setAiPlan(null); setAiOpen(false); setDrafts({});
    setNotice({ tone: 'ok', text: changed === 1 ? 'Se llenó 1 comida del menú.' : `Se llenaron ${changed} comidas del menú.` });
  }

  async function doArchive() {
    if (!window.confirm('¿Archivar esta semana y empezar una nueva en blanco?')) return;
    const { error } = await archiveWeek();
    setDrafts({}); setShop(null);
    setNotice(error ? { tone: 'error', text: error } : { tone: 'ok', text: 'Semana archivada. Empezaste una nueva.' });
  }

  async function reuse(week: MenuWeek) {
    if (planned.length > 0 && !window.confirm('Esto reemplaza el menú de esta semana. ¿Continuar?')) return;
    const { error } = await saveWeekDays(week.days);
    setDrafts({});
    setNotice(error ? { tone: 'error', text: error } : { tone: 'ok', text: 'Se copió ese menú a esta semana.' });
  }

  async function buildShoppingList() {
    if (shopLoading || !active) return;
    setShopLoading(true); setShop(null); setNotice(null);
    const notes: string[] = [];
    try {
      const matchedIngredients: ParsedIngredient[] = [];
      const unmatched: string[] = [];
      for (const meal of planned) {
        const recipe = findRecipeForMeal(recipes, meal.text);
        if (recipe) matchedIngredients.push(...recipe.ingredients.map(i => parseIngredient(i)).filter((x): x is ParsedIngredient => x !== null));
        else if (!unmatched.some(u => u.toLowerCase() === meal.text.toLowerCase())) unmatched.push(meal.text);
      }
      let inPantry = 0;
      const fromRecipes: ShoppingItem[] = mergeIngredients(matchedIngredients)
        .filter(i => { const has = Boolean(findDuplicate(stockedPantry, i.name)); if (has) inPantry++; return !has; })
        .map(i => ({ ...i, why: 'De tus recetas', estimated_price: null }));

      let fromAI: ShoppingItem[] = [];
      if (unmatched.length) {
        try {
          const res = await postJSON('/.netlify/functions/home-assistant', {
            mode: 'shopping',
            customPrompt: `Haz la lista de compras con SOLO los ingredientes para preparar estos platillos para ${people} personas, una vez cada uno: ${unmatched.join('; ')}`,
            household: { people, days: 7, budget: null, store: null },
            pantry: pantry.slice(0, 80).map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })),
            preferences,
          });
          if (!res.ok) throw new Error(res.data?.error || 'La IA tardó demasiado.');
          fromAI = normalizeShoppingResponse(res.data).items.map(i => ({ ...i, estimated_price: null, why: 'Calculado con IA' }));
          if (!fromAI.length) throw new Error('La IA no devolvió productos.');
        } catch (e) {
          notes.push(`No pude calcular los ingredientes de: ${unmatched.join(', ')}. ${e instanceof Error && !(e instanceof TypeError) && !(e instanceof DOMException) ? e.message : networkMessage(e, 'responder')} Puedes guardarlos como receta y volver a intentar.`);
        }
      }
      const items: ShoppingItem[] = [...fromRecipes];
      for (const item of fromAI) if (!findDuplicate(items.map(i => ({ text: i.name, checked: false })), item.name) && !findDuplicate(stockedPantry, item.name)) items.push(item);
      if (inPantry) notes.push(inPantry === 1 ? '1 ingrediente no aparece porque ya lo tienes en la despensa.' : `${inPantry} ingredientes no aparecen porque ya los tienes en la despensa.`);
      if (unmatched.length && fromAI.length) notes.push(`Cantidades calculadas con IA para: ${unmatched.join(', ')}.`);
      if (!items.length) { setNotice({ tone: notes.length ? 'error' : 'ok', text: notes.join(' ') || 'No hay nada que comprar: ya tienes todo en la despensa.' }); return; }
      setShopCount(c => c + 1);
      setShop({ key: shopCount + 1, items, notes });
    } finally { setShopLoading(false); }
  }

  if (!active) return null;
  const weekLabel = (() => { const [y, m, d] = active.week_start.split('-').map(Number); return y ? new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : ''; })();

  return (
    <Page title="Menú semanal" subtitle={`${planned.length} de 14 comidas planeadas${weekLabel ? ` · semana del ${weekLabel}` : ''}`} action={<button className="secondary small" onClick={() => void doArchive()}><Archive size={17} />Archivar</button>}>
      {notice && <div className={`ai-notice ${notice.tone === 'error' ? 'error' : ''}`} role="status">{notice.tone === 'ok' ? <Check size={18} /> : <AlertCircle size={18} />}{notice.text}</div>}

      <div className="mn-toolbar">
        <button type="button" className="primary small" onClick={() => setAiOpen(!aiOpen)}><Sparkles size={16} />Armar semana con IA</button>
        <button type="button" className="secondary small" disabled={planned.length === 0 || shopLoading} onClick={() => void buildShoppingList()}><ShoppingCart size={16} />{shopLoading ? 'Calculando…' : 'Lista de compras del menú'}</button>
      </div>

      {aiOpen && (
        <section className="card mn-ai">
          <h3>Armar la semana con IA</h3>
          <p className="muted">Respeta las dietas de Ajustes, usa tus recetas y lo que ya tienes. No cambia lo que ya escribiste hasta que tú lo apliques.</p>
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ej. semana económica, cenas ligeras" aria-label="Pedido para el menú" />
          <div className="mn-chips" role="group" aria-label="Qué comidas incluir">
            {MENU_SLOTS.map(s => <button type="button" key={s} aria-pressed={aiSlots.includes(s)} className={aiSlots.includes(s) ? 'on' : ''} onClick={() => setAiSlots(cur => cur.includes(s) ? (cur.length > 1 ? cur.filter(x => x !== s) : cur) : [...cur, s])}>{aiSlots.includes(s) ? '✓ ' : ''}{SLOT_LABEL[s]}</button>)}
          </div>
          <div className="mn-people"><span>Para</span><b>{householdSummary(household)}</b><button type="button" className="ghost small" onClick={() => navigate('/ajustes')}>Cambiar</button></div>
          {household.some(h => h.kind === 'bebé') && <small className="muted">El bebé no cuenta en las cantidades; la IA sugiere cosas aptas para su edad.</small>}
          <button type="button" className="primary" disabled={aiLoading} onClick={() => void generateWeek()}>{aiLoading ? 'Armando menú…' : 'Generar menú'}</button>
          {aiError && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No pude armar el menú</strong><p>{aiError}</p></div><button type="button" className="secondary small" onClick={() => void generateWeek()}>Reintentar</button></div>}
          {aiPlan && (
            <div className="mn-plan">
              {aiPlan.answer && <p className="assistant-answer">{aiPlan.answer}</p>}
              <ul>{MENU_DAYS.map(day => <li key={day}><strong>{day}</strong>{MENU_SLOTS.filter(s => aiPlan.days[day]?.[s]).map(s => <span key={s}><small>{SLOT_LABEL[s]}: </small>{aiPlan.days[day]?.[s]}</span>)}</li>)}</ul>
              <div className="actions">
                <button type="button" className="primary small" onClick={() => void applyPlan('empty')}>Aplicar solo a los vacíos</button>
                <button type="button" className="secondary small" onClick={() => void applyPlan('all')}>Reemplazar todo</button>
                <button type="button" className="ghost small" onClick={() => setAiPlan(null)}>Descartar</button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="week-grid">
        {MENU_DAYS.map(day => (
          <article className="day-card" key={day}>
            <h3>{day}</h3>
            {MENU_SLOTS.map(slot => {
              const key = `${day}|${slot}`;
              const open = picker?.day === day && picker.slot === slot;
              return (
                <div className="mn-slot" key={slot}>
                  <span className="mn-label">{SLOT_LABEL[slot]}</span>
                  <div className="mn-input">
                    <input
                      aria-label={`${SLOT_LABEL[slot]} del ${day}`}
                      value={valueOf(day, slot)}
                      onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                      onBlur={e => void commit(day, slot, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      placeholder="Escribe o elige una receta…"
                    />
                    <button type="button" className="spark" aria-label={`Elegir ${SLOT_LABEL[slot].toLowerCase()} del ${day}`} onClick={() => setPicker(open ? null : { day, slot })}><BookOpen size={16} /></button>
                  </div>
                  {open && <SlotPicker day={day} slot={slot} recipes={recipes} context={aiContext} onPick={name => void pick(name)} onClose={() => setPicker(null)} />}
                </div>
              );
            })}
          </article>
        ))}
      </div>

      {shop && (
        <section className="mn-shop">
          <h3>Lista de compras del menú</h3>
          {shop.notes.map(note => <p className="sl-note" key={note}>{note}</p>)}
          <SmartShoppingList key={shop.key} items={shop.items} answer="" household={{ people, days: 7, budget: null, store: null }} groceries={groceries} onAdd={rows => addGroceryBatch(rows.map(r => ({ ...r, source: 'menu' })))} onViewList={() => navigate('/lista')} />
        </section>
      )}

      {archived.length > 0 && (
        <details className="history">
          <summary>Historial de semanas ({archived.length})</summary>
          {archived.map(w => {
            const count = plannedMeals(w.days).length;
            return <div className="card mn-history" key={w.id}><div><strong>{w.label} · {w.week_start}</strong><small>{count} comidas</small></div>{count > 0 && <button type="button" className="secondary small" onClick={() => void reuse(w)}><Copy size={15} />Usar de nuevo</button>}</div>;
          })}
        </details>
      )}
    </Page>
  );
}
