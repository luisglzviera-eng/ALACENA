import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Camera, Check, ChevronDown, ChevronUp, Clock3, Info, Plus, Search, ShoppingCart, Sparkles, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Empty, Page } from '../components/UI';
import { b64ToJpegBlob } from '../lib/image';
import IngredientPicker from '../components/IngredientPicker';
import { moneyApprox, parseIngredient, stepsToNotes, type GeneratedRecipe } from '../lib/shopping';

const recipeImages = ['/images/recipe-pasta.svg', '/images/recipe-salad.svg', '/images/recipe-soup.svg'];

const MODES = [
  { id: 'kids', label: 'Para niños', prompt: 'Recetas rápidas y fáciles para niños' },
  { id: 'snack', label: 'Snacks', prompt: 'Ideas de snacks rápidos' },
  { id: 'budget', label: 'Económicas', prompt: 'Recetas económicas y rendidoras' },
  { id: 'pantry', label: 'Con mi despensa', prompt: 'Recetas con lo que ya tengo' },
  { id: 'general', label: 'Cena familiar', prompt: 'Ideas de cena para la familia' },
] as const;
type Mode = (typeof MODES)[number]['id'];

type Failure = { message: string; slow: boolean };

function Steps({ text }: { text: string }) {
  return <p className="recipe-steps">{text}</p>;
}

export default function Recipes() {
  const navigate = useNavigate();
  const { recipes, groceries, pantry, preferences, saveRecipe, deleteRecipe, addGroceryBatch, setRecipePhoto } = useApp();
  const [photoBusy, setPhotoBusy] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string>();
  const [picker, setPicker] = useState<string>();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const [ask, setAsk] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedRecipe[]>([]);
  const [answer, setAnswer] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingName, setSavingName] = useState<string>();
  const last = useRef<{ mode: Mode; prompt: string }>({ mode: 'general', prompt: '' });

  const filtered = useMemo(() => recipes.filter(recipe => recipe.name.toLowerCase().includes(query.toLowerCase())), [recipes, query]);

  async function generate(mode: Mode, prompt: string, count = 3) {
    if (loading) return;
    last.current = { mode, prompt };
    setLoading(true);
    setFailure(null);
    setNotice(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32000);
    try {
      const response = await fetch('/.netlify/functions/generate-recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          prompt,
          count,
          preferences: { diet_user: preferences.diet_user, diet_partner: preferences.diet_partner, budget_priority: preferences.budget_priority },
          pantry: pantry.filter(p => Number(p.quantity) > 0).slice(0, 60).map(p => ({ name: p.name })),
          savedRecipes: recipes.slice(0, 30).map(r => ({ name: r.name })),
        }),
      });
      let data: any = null;
      try { data = await response.json(); } catch { /* respuesta que no es JSON: normalmente el límite de tiempo de Netlify */ }
      if (!response.ok || !data) {
        setFailure({ message: data?.error || 'El servidor tardó demasiado en responder. Prueba con menos recetas.', slow: !data });
        return;
      }
      setResults(data.recipes || []);
      setAnswer(data.answer || '');
      setSaved({});
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      setFailure({ message: aborted ? 'La IA tardó demasiado en responder. Prueba con menos recetas.' : 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.', slow: aborted });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }


  async function makePhoto(target: { id: string; name: string; ingredients: string[] }) {
    if (photoBusy[target.id]) return;
    setPhotoBusy(prev => ({ ...prev, [target.id]: true }));
    setPhotoError(prev => { const { [target.id]: _gone, ...rest } = prev; return rest; });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch('/.netlify/functions/generate-recipe-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ name: target.name, ingredients: target.ingredients.slice(0, 6) }),
      });
      let data: any = null;
      try { data = await response.json(); } catch { /* no JSON: límite de tiempo de Netlify */ }
      if (!response.ok || !data?.image) throw new Error(data?.error || 'La foto tardó demasiado en generarse. Intenta de nuevo.');
      const blob = await b64ToJpegBlob(data.image, data.mime || 'image/jpeg');
      const { error } = await setRecipePhoto(target.id, blob);
      if (error) throw new Error(error);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      const offline = error instanceof TypeError;
      setPhotoError(prev => ({ ...prev, [target.id]: aborted ? 'La foto tardó demasiado. Intenta de nuevo.' : offline ? 'No hay conexión para generar la foto.' : error instanceof Error ? error.message : 'No se pudo generar la foto.' }));
    } finally {
      clearTimeout(timer);
      setPhotoBusy(prev => ({ ...prev, [target.id]: false }));
    }
  }

  async function saveGenerated(recipe: GeneratedRecipe) {
    setSavingName(recipe.name);
    const { error, recipe: created } = await saveRecipe({
      name: recipe.name,
      ingredients: recipe.ingredients,
      notes: stepsToNotes(recipe.steps),
      tags: Array.from(new Set(['ia', ...recipe.tags])),
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
    });
    setSavingName(undefined);
    if (error) setNotice({ tone: 'error', text: error });
    else {
      setSaved(prev => ({ ...prev, [recipe.name]: true }));
      setNotice({ tone: 'ok', text: `Guardaste “${recipe.name}” en tu recetario. Generando su foto…` });
      if (created) void makePhoto({ id: created.id, name: created.name, ingredients: created.ingredients });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const { error } = await saveRecipe({ name: name.trim(), ingredients: ingredients.split('\n').map(x => x.trim()).filter(Boolean), notes: instructions, tags: [], servings: 2, prep_minutes: 30 });
    if (error) { setNotice({ tone: 'error', text: error }); return; }
    setName(''); setIngredients(''); setInstructions(''); setShowForm(false);
    setNotice({ tone: 'ok', text: 'Receta guardada.' });
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`¿Eliminar “${title}”?`)) return;
    const { error } = await deleteRecipe(id);
    setNotice(error ? { tone: 'error', text: error } : { tone: 'ok', text: `Se eliminó “${title}”.` });
  }

  const dietHint = preferences.diet_user || preferences.diet_partner ? 'Respeta las dietas guardadas en Ajustes.' : 'Guarda las dietas en Ajustes para que las respete.';

  return (
    <Page title="Recetario" subtitle="Tus favoritas, listas para cocinar." action={<button className="primary" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Nueva receta</button>}>
      {notice && <div className={`ai-notice ${notice.tone === 'error' ? 'error' : ''}`} role="status">{notice.tone === 'ok' ? <Check size={18} /> : <AlertCircle size={18} />}{notice.text}</div>}

      <section className="card rg-card">
        <span className="hero-kicker"><Sparkles size={15} /> CREAR CON IA</span>
        <h3>¿Qué se te antoja cocinar?</h3>
        <p className="muted">{dietHint}</p>
        <form className="rg-form" onSubmit={event => { event.preventDefault(); void generate(last.current.mode, ask.trim()); }}>
          <input value={ask} onChange={event => setAsk(event.target.value)} placeholder="Ej. cena ligera con pollo para 4" aria-label="Pedido de receta" />
          <button className="primary" disabled={loading} aria-label="Generar recetas"><Sparkles size={17} />{loading ? 'Pensando…' : 'Generar'}</button>
        </form>
        <div className="sl-examples rg-modes">
          {MODES.map(mode => <button type="button" key={mode.id} disabled={loading} onClick={() => void generate(mode.id, ask.trim() || mode.prompt)}>{mode.label}</button>)}
        </div>
        {loading && <p className="muted" role="status">Preparando ideas, tarda unos segundos…</p>}
        {failure && (
          <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No pude generar recetas</strong><p>{failure.message}</p></div>
            <button type="button" className="secondary small" onClick={() => void generate(last.current.mode, last.current.prompt, failure.slow ? 2 : 3)}>{failure.slow ? 'Reintentar con 2' : 'Reintentar'}</button></div>
        )}
      </section>

      {results.length > 0 && (
        <section className="rg-results">
          {answer && <p className="assistant-answer">{answer}</p>}
          {results.map((recipe, index) => (
            <article className="card rg-recipe" key={recipe.name}>
              <h3>{recipe.name}</h3>
              <p className="rg-meta"><Clock3 size={14} /> {recipe.prep_minutes} min · <Users size={14} /> {recipe.servings} porciones{recipe.estimated_cost !== null && <> · ≈ {moneyApprox(recipe.estimated_cost)}</>}</p>
              {recipe.why && <p>{recipe.why}</p>}
              {recipe.fits && <p className="rg-fits"><Check size={14} /> {recipe.fits}</p>}
              {recipe.tags.length > 0 && <div className="sl-chips">{recipe.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
              <h4>Ingredientes</h4>
              <ul>{recipe.ingredients.map((item, i) => <li key={i}>{item}</li>)}</ul>
              <h4>Preparación</h4>
              <Steps text={stepsToNotes(recipe.steps)} />
              {recipe.estimated_cost !== null && <p className="sl-note"><Info size={14} />Costo estimado por la IA, no es un precio real de la tienda.</p>}
              <div className="actions">
                <button className="primary small" disabled={Boolean(saved[recipe.name]) || savingName === recipe.name} onClick={() => void saveGenerated(recipe)}>
                  {saved[recipe.name] ? 'Guardada ✓' : savingName === recipe.name ? 'Guardando…' : 'Guardar receta'}
                </button>
                <button className="secondary small" onClick={() => setPicker(picker === `gen-${index}` ? undefined : `gen-${index}`)}><ShoppingCart size={16} />Ingredientes a Compras</button>
              </div>
              {picker === `gen-${index}` && <IngredientPicker ingredients={recipe.ingredients} groceries={groceries} pantry={pantry} onAdd={addGroceryBatch} onViewList={() => navigate('/lista')} />}
            </article>
          ))}
        </section>
      )}

      <div className="search-bar"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en mis recetas…" /></div>

      {showForm && (
        <form className="card recipe-form" onSubmit={submit}>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre de la receta" />
          <textarea value={ingredients} onChange={event => setIngredients(event.target.value)} placeholder="Un ingrediente por línea (ej. 500 g pechuga de pollo)" rows={5} />
          <textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Preparación" rows={5} />
          <button className="primary">Guardar receta</button>
        </form>
      )}

      {filtered.length === 0 ? <Empty>Aún no hay recetas guardadas.</Empty> : (
        <div className="recipe-grid">
          {filtered.map((recipe, index) => (
            <article className="recipe-card" key={recipe.id}>
              <div className="recipe-photo">
                <img src={recipe.image_url || recipeImages[index % recipeImages.length]} alt={recipe.name} loading="lazy" onError={event => { event.currentTarget.src = recipeImages[index % recipeImages.length]; }} />
                {photoBusy[recipe.id] && <span className="photo-badge" role="status"><Camera size={14} /> Generando foto…</span>}
              </div>
              <div className="recipe-card-body">
                <button className="recipe-title" onClick={() => setOpen(open === recipe.id ? undefined : recipe.id)}>
                  <span><strong>{recipe.name}</strong><small><Clock3 size={14} /> {recipe.prep_minutes || 30} min · <Users size={14} /> {recipe.servings || 2}</small></span>
                  {open === recipe.id ? <ChevronUp /> : <ChevronDown />}
                </button>
                {open === recipe.id && (
                  <div className="recipe-body">
                    <h4>Ingredientes</h4><ul>{recipe.ingredients.map((ingredient, i) => <li key={i}>{ingredient}</li>)}</ul>
                    <h4>Preparación</h4><Steps text={recipe.notes} />
                    <div className="actions">
                      <button className="primary small" onClick={() => setPicker(picker === recipe.id ? undefined : recipe.id)}><ShoppingCart size={16} />Agregar a Compras</button>
                      <button className="secondary small" disabled={photoBusy[recipe.id]} onClick={() => void makePhoto(recipe)}><Camera size={16} />{photoBusy[recipe.id] ? 'Generando…' : recipe.image_url ? 'Nueva foto' : 'Generar foto'}</button>
                      <button className="ghost danger small" onClick={() => void remove(recipe.id, recipe.name)}>Eliminar</button>
                    </div>
                    {photoError[recipe.id] && <div className="sl-error" role="alert"><AlertCircle size={18} /><div><strong>No se pudo generar la foto</strong><p>{photoError[recipe.id]}</p></div></div>}
                    {picker === recipe.id && <IngredientPicker ingredients={recipe.ingredients.filter(i => parseIngredient(i))} groceries={groceries} pantry={pantry} onAdd={addGroceryBatch} onViewList={() => navigate('/lista')} />}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}
