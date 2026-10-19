import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Camera, Check, ChefHat, Mic, PackagePlus, Plus, Send, ShoppingCart, Sparkles, Utensils } from 'lucide-react';
import { Page } from '../components/UI';
import SmartShoppingList from '../components/SmartShoppingList';
import { useApp } from '../context/AppContext';
import { CATEGORIES, type Category } from '../types';
import { fileToBase64 } from '../lib/utils';
import {
  guessCategory,
  normalizeCategory,
  normalizeShoppingResponse,
  normalizeUnit,
  parseShoppingRequest,
  type Household,
  type NewGroceryRow,
  type ShoppingItem,
} from '../lib/shopping';

type AIItem = {
  name: string;
  why?: string;
  category?: Category;
  quantity?: number;
  unit?: string;
  ingredients?: string[];
};

type Notice = { tone: 'ok' | 'error'; text: string };
type Plan = { key: number; items: ShoppingItem[]; answer: string; household: Household };
type LastRequest = { mode: string; image?: File; customPrompt?: string };

const EXAMPLES = [
  { label: 'Lista HEB · 4 personas · 7 días · $2,500', prompt: 'Haz una lista de compras para HEB para cuatro personas durante siete días con un presupuesto de $2,500' },
  { label: 'Costco · 15 días', prompt: 'Haz una lista de compras para Costco para 15 días' },
  { label: 'Básicos de la semana', prompt: 'Haz una lista de compras con los básicos de la semana' },
];

function inferMode(prompt: string) {
  const value = prompt.toLowerCase();
  if (/(lista|súper|super|heb|costco|walmart|soriana|comprar|compras)/.test(value)) return 'shopping';
  if (/(receta|cocinar|comida|cena|desayuno|platillo)/.test(value)) return 'cook';
  if (/(sobrante|sobras|aprovechar)/.test(value)) return 'leftovers';
  if (/(vencer|caducar|caducidad)/.test(value)) return 'expiring';
  return 'general';
}

export default function Assistant() {
  const { pantry, recipes, preferences, weeks, leftovers, groceries, saveLeftover, deleteLeftover, generateSmartList, addGroceryBatch } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<AIItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState('');
  const [question, setQuestion] = useState('');
  const [lastMode, setLastMode] = useState('general');
  const [notice, setNotice] = useState<Notice | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastRequest = useRef<LastRequest | null>(null);
  const planCounter = useRef(0);

  async function ask(mode: string, image?: File, customPrompt?: string) {
    lastRequest.current = { mode, image, customPrompt };
    setLoading(true);
    setError('');
    setAnswer('');
    setItems([]);
    setSelected([]);
    setPlan(null);
    setNotice(null);
    setLastMode(mode);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 32000);
    try {
      let imageBase64;
      let mediaType;
      if (image) {
        imageBase64 = await fileToBase64(image);
        mediaType = image.type;
      }
      const household = mode === 'shopping' && customPrompt ? parseShoppingRequest(customPrompt) : undefined;
      const payload = mode === 'shopping'
        ? { mode, customPrompt, household, pantry, preferences }
        : { mode, customPrompt, pantry, recipes, preferences, leftovers, recentMeals: weeks.slice(0, 6), imageBase64, mediaType };
      const response = await fetch('/.netlify/functions/home-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const slow = response.status === 502 || response.status === 504;
        throw new Error(data.error || (slow
          ? 'El servidor tardó demasiado en responder. Intenta de nuevo con una lista más corta (por ejemplo, 3 días).'
          : `La IA respondió con error ${response.status}`));
      }

      if (mode === 'shopping') {
        const normalized = normalizeShoppingResponse(data);
        if (!normalized.items.length) throw new Error('La IA no devolvió productos válidos. Intenta de nuevo o describe tu lista con más detalle.');
        const parsed = household ?? { people: null, days: null, budget: null, store: null };
        const fromServer = (data.household && typeof data.household === 'object' ? data.household : {}) as Partial<Household>;
        planCounter.current += 1;
        setPlan({
          key: planCounter.current,
          items: normalized.items,
          answer: normalized.answer,
          household: {
            people: Number(fromServer.people) || parsed.people,
            days: Number(fromServer.days) || parsed.days,
            budget: Number(fromServer.budget) || parsed.budget,
            store: fromServer.store || parsed.store,
          },
        });
        return;
      }

      const raw = [
        ...(Array.isArray(data.items) ? data.items : []),
        ...(Array.isArray(data.suggestions) ? data.suggestions : []),
        ...(Array.isArray(data.detected) ? data.detected : []),
      ];
      const normalized: AIItem[] = raw.map((item: any) => {
        if (typeof item === 'string') return { name: item };
        return {
          name: String(item.name || item.idea || item.title || 'Sugerencia'),
          why: item.why ? String(item.why) : '',
          category: CATEGORIES.includes(item.category) ? item.category as Category : undefined,
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          unit: item.unit ? String(item.unit) : 'pza',
          ingredients: Array.isArray(item.ingredients) ? item.ingredients.map(String) : [],
        };
      }).filter(item => item.name.trim());

      setAnswer(typeof data.answer === 'string' ? data.answer : '');
      setItems(normalized);
      setSelected(normalized.map((_, index) => index));
      if (!data.answer && normalized.length === 0) throw new Error('La IA no devolvió resultados útiles. Intenta formular la pregunta de otra manera.');
    } catch (requestError) {
      const message = requestError instanceof DOMException && requestError.name === 'AbortError'
        ? 'La IA tardó demasiado en responder. Intenta nuevamente (si es una lista grande, prueba con menos días).'
        : requestError instanceof TypeError
          ? 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.'
          : requestError instanceof Error ? requestError.message : 'No se pudo consultar la IA.';
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function runPrompt(text: string) {
    setQuestion(text);
    void ask(inferMode(text), undefined, text);
  }

  async function addItems(indices: number[]) {
    const rows: NewGroceryRow[] = [];
    for (const index of indices) {
      const item = items[index];
      if (!item) continue;
      if (lastMode === 'cook' && item.ingredients?.length) {
        for (const ingredient of item.ingredients) rows.push({ name: ingredient, category: guessCategory(ingredient), quantity: 1, unit: 'pza', source: 'ai-recipe' });
      } else {
        rows.push({ name: item.name, category: normalizeCategory(item.category, item.name), quantity: item.quantity || 1, unit: normalizeUnit(item.unit), source: 'ai' });
      }
    }
    const result = await addGroceryBatch(rows);
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    const dup = result.duplicates.length ? ` ${result.duplicates.length === 1 ? '1 ya estaba' : `${result.duplicates.length} ya estaban`} en tu lista.` : '';
    setNotice({
      tone: 'ok',
      text: result.added > 0
        ? `${result.added} ${result.added === 1 ? 'producto agregado' : 'productos agregados'} a Compras.${dup}`
        : 'Esos productos ya estaban en tu lista de Compras.',
    });
  }

  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (!prompt) return;
    setQuestion(prompt);
    void ask(inferMode(prompt), undefined, prompt);
    window.history.replaceState({}, document.title);
  }, []);

  function voice(target: 'question' | 'left' = 'question') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert('El dictado no está disponible en este navegador.');
    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.onresult = (event: any) => target === 'left'
      ? setLeft(event.results[0][0].transcript)
      : setQuestion(event.results[0][0].transcript);
    recognition.start();
  }

  function retry() {
    const request = lastRequest.current;
    if (request) void ask(request.mode, request.image, request.customPrompt);
  }

  return (
    <Page title="Alacena IA" subtitle="Pregunta usando tu despensa, menú y hábitos de compra">
      <form className="assistant-command" onSubmit={(event) => { event.preventDefault(); if (question.trim() && !loading) runPrompt(question.trim()); }}>
        <Sparkles size={21} />
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ej. Haz una lista para HEB para toda la semana" aria-label="Pregunta para Alacena IA" />
        <button type="button" className="icon-btn" onClick={() => voice('question')} aria-label="Dictar"><Mic size={19} /></button>
        <button type="submit" className="primary icon" disabled={loading} aria-label="Enviar"><Send size={18} /></button>
      </form>

      <div className="sl-examples" aria-label="Ejemplos">
        {EXAMPLES.map(example => (
          <button type="button" key={example.label} disabled={loading} onClick={() => runPrompt(example.prompt)}>{example.label}</button>
        ))}
      </div>

      <div className="assistant-actions">
        <button className="feature-btn" onClick={() => ask('cook')}><ChefHat /><strong>¿Qué cocinar hoy?</strong><span>Recetas con lo que ya tienes</span></button>
        <button className="feature-btn" onClick={() => ask('leftovers')}><Utensils /><strong>Aprovechar sobrantes</strong><span>Ideas para no desperdiciar</span></button>
        <button className="feature-btn" onClick={async () => { const count = await generateSmartList(); setNotice({ tone: 'ok', text: `Se agregaron ${count} faltantes del menú y productos bajos.` }); }}><PackagePlus /><strong>Generar lista inteligente</strong><span>Menú menos lo que ya tienes</span></button>
        <button className="feature-btn" onClick={() => file.current?.click()}><Camera /><strong>Foto del refrigerador</strong><span>Detectar alimentos visibles</span></button>
        <input hidden ref={file} type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && ask('fridge', event.target.files[0])} />
      </div>

      <div className="card">
        <h3>Registrar sobrante</h3>
        <div className="voice-row">
          <input value={left} onChange={(event) => setLeft(event.target.value)} placeholder="Ej. pollo asado, 2 porciones" />
          <button className="icon-btn" onClick={() => voice('left')}><Mic /></button>
          <button className="primary small" onClick={() => { if (left) { saveLeftover({ name: left, quantity: '1', expires_on: null }); setLeft(''); } }}>Guardar</button>
        </div>
        {leftovers.map((item) => <div className="simple-row" key={item.id}><span>{item.name}</span><button className="ghost danger" onClick={() => deleteLeftover(item.id)}>Quitar</button></div>)}
      </div>

      {loading && <div className="loading" role="status"><Sparkles />{lastMode === 'shopping' ? 'Armando tu lista… puede tardar unos segundos' : 'Pensando…'}</div>}
      {error && <div className="card ai-error" role="alert"><strong>No pude responder</strong><p>{error}</p><button className="secondary small" onClick={retry}>Intentar otra vez</button></div>}
      {notice && (
        <div className={`ai-notice ${notice.tone === 'error' ? 'error' : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.tone === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}{notice.text}
          {notice.tone === 'ok' && <button className="ghost small" onClick={() => navigate('/lista')}>Ver Compras</button>}
        </div>
      )}

      {plan && (
        <SmartShoppingList
          key={plan.key}
          items={plan.items}
          answer={plan.answer}
          household={plan.household}
          groceries={groceries}
          onAdd={addGroceryBatch}
          onViewList={() => navigate('/lista')}
        />
      )}

      {!plan && (answer || items.length > 0) && <div className="card ai-results">
        <div className="ai-results-head">
          <div><h3>Respuesta de Alacena</h3>{answer && <p className="assistant-answer">{answer}</p>}</div>
          {items.length > 0 && <button className="primary small" disabled={selected.length === 0} onClick={() => addItems(selected)}><ShoppingCart size={17} />Agregar seleccionados ({selected.length})</button>}
        </div>
        <div className="ai-select-list">
          {items.map((item, index) => {
            const checked = selected.includes(index);
            return <div className={`ai-select-item ${checked ? 'selected' : ''}`} key={`${item.name}-${index}`}>
              <button className="ai-check" onClick={() => setSelected(value => checked ? value.filter(x => x !== index) : [...value, index])} aria-label={checked ? 'Quitar selección' : 'Seleccionar'}>{checked && <Check size={16} />}</button>
              <div className="ai-item-copy"><strong>{item.name}</strong>{item.why && <span>{item.why}</span>}{item.ingredients && item.ingredients.length > 0 && <small>{item.ingredients.join(' · ')}</small>}</div>
              <button className="icon-btn" title="Agregar solo este" onClick={() => addItems([index])}><Plus size={18} /></button>
            </div>;
          })}
        </div>
      </div>}
    </Page>
  );
}
