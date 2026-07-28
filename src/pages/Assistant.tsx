import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, Check, ChefHat, Mic, PackagePlus, Plus, Send, ShoppingCart, Sparkles, Utensils } from 'lucide-react';
import { Page } from '../components/UI';
import { useApp } from '../context/AppContext';
import { CATEGORIES, type Category } from '../types';
import { fileToBase64 } from '../lib/utils';

type AIItem = {
  name: string;
  why?: string;
  category?: Category;
  quantity?: number;
  unit?: string;
  ingredients?: string[];
};

function inferMode(prompt: string) {
  const value = prompt.toLowerCase();
  if (/(lista|súper|super|heb|costco|walmart|soriana|comprar|compras)/.test(value)) return 'shopping';
  if (/(receta|cocinar|comida|cena|desayuno|platillo)/.test(value)) return 'cook';
  if (/(sobrante|sobras|aprovechar)/.test(value)) return 'leftovers';
  if (/(vencer|caducar|caducidad)/.test(value)) return 'expiring';
  return 'general';
}

function validCategory(value: unknown): Category {
  return CATEGORIES.includes(value as Category) ? value as Category : 'Otros';
}

export default function Assistant() {
  const { pantry, recipes, preferences, weeks, leftovers, saveLeftover, deleteLeftover, generateSmartList, addGrocery } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<AIItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState('');
  const [question, setQuestion] = useState('');
  const [lastMode, setLastMode] = useState('general');
  const [notice, setNotice] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function ask(mode: string, image?: File, customPrompt?: string) {
    setLoading(true);
    setError('');
    setAnswer('');
    setItems([]);
    setSelected([]);
    setNotice('');
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
      const response = await fetch('/.netlify/functions/home-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ mode, customPrompt, pantry, recipes, preferences, leftovers, recentMeals: weeks.slice(0, 6), imageBase64, mediaType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `La IA respondió con error ${response.status}`);

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
          category: validCategory(item.category),
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
        ? 'La IA tardó demasiado en responder. Intenta nuevamente.'
        : requestError instanceof Error ? requestError.message : 'No se pudo consultar la IA.';
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function addItems(indices: number[]) {
    let added = 0;
    for (const index of indices) {
      const item = items[index];
      if (!item) continue;
      if (lastMode === 'cook' && item.ingredients?.length) {
        for (const ingredient of item.ingredients) {
          await addGrocery(ingredient, 'Despensa', 1, 'pza', 'ai-recipe');
          added++;
        }
      } else {
        await addGrocery(item.name, validCategory(item.category), item.quantity || 1, item.unit || 'pza', 'ai');
        added++;
      }
    }
    setNotice(`${added} ${added === 1 ? 'producto agregado' : 'productos agregados'} a Compras.`);
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

  return (
    <Page title="Alacena IA" subtitle="Pregunta usando tu despensa, menú y hábitos de compra">
      <form className="assistant-command" onSubmit={(event) => { event.preventDefault(); if (question.trim()) void ask(inferMode(question), undefined, question.trim()); }}>
        <Sparkles size={21} />
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ej. Haz una lista para HEB para toda la semana" />
        <button type="button" className="icon-btn" onClick={() => voice('question')}><Mic size={19} /></button>
        <button type="submit" className="primary icon"><Send size={18} /></button>
      </form>

      <div className="assistant-actions">
        <button className="feature-btn" onClick={() => ask('cook')}><ChefHat /><strong>¿Qué cocinar hoy?</strong><span>Recetas con lo que ya tienes</span></button>
        <button className="feature-btn" onClick={() => ask('leftovers')}><Utensils /><strong>Aprovechar sobrantes</strong><span>Ideas para no desperdiciar</span></button>
        <button className="feature-btn" onClick={async () => { const count = await generateSmartList(); setNotice(`Se agregaron ${count} faltantes del menú y productos bajos.`); }}><PackagePlus /><strong>Generar lista inteligente</strong><span>Menú menos lo que ya tienes</span></button>
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

      {loading && <div className="loading"><Sparkles />Pensando…</div>}
      {error && <div className="card ai-error"><strong>No pude responder</strong><p>{error}</p><button className="secondary small" onClick={() => question.trim() && ask(inferMode(question), undefined, question.trim())}>Intentar otra vez</button></div>}
      {notice && <div className="ai-notice"><Check size={18} />{notice}<button className="ghost small" onClick={() => navigate('/grocery')}>Ver Compras</button></div>}

      {(answer || items.length > 0) && <div className="card ai-results">
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
