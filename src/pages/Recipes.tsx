import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Plus, Search, Sparkles, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Empty, Page } from '../components/UI';

const recipeImages = ['/images/recipe-pasta.svg', '/images/recipe-salad.svg', '/images/recipe-soup.svg'];

export default function Recipes() {
  const { recipes, saveRecipe, deleteRecipe, addRecipeToList } = useApp();
  const [open, setOpen] = useState<string>();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');

  const filtered = useMemo(() => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())), [recipes, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await saveRecipe({ name: name.trim(), ingredients: ingredients.split('\n').filter(Boolean), notes: instructions, tags: [], servings: 2, prep_minutes: 30 });
    setName(''); setIngredients(''); setInstructions(''); setShowForm(false);
  }

  return (
    <Page title="Recetario" subtitle="Tus favoritas, listas para cocinar." action={<button className="primary" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Nueva receta</button>}>
      <div className="search-bar"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar recetas…" /></div>

      <section className="recipe-feature">
        <img src="/images/recipe-pasta.svg" alt="Pasta casera" />
        <div><span className="hero-kicker"><Sparkles size={15} /> RECOMENDADA PARA HOY</span><h3>Pasta cremosa de despensa</h3><p>Una opción rápida, reconfortante y fácil de adaptar con lo que ya tienes.</p></div>
      </section>

      {showForm && (
        <form className="card recipe-form" onSubmit={submit}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la receta" />
          <textarea value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="Un ingrediente por línea" rows={5} />
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Preparación" rows={5} />
          <button className="primary">Guardar receta</button>
        </form>
      )}

      {filtered.length === 0 ? <Empty>Aún no hay recetas guardadas.</Empty> : (
        <div className="recipe-grid">
          {filtered.map((recipe, index) => (
            <article className="recipe-card" key={recipe.id}>
              <img src={recipeImages[index % recipeImages.length]} alt={recipe.name} />
              <div className="recipe-card-body">
                <button className="recipe-title" onClick={() => setOpen(open === recipe.id ? undefined : recipe.id)}>
                  <span><strong>{recipe.name}</strong><small><Clock3 size={14} /> {recipe.prep_minutes || 30} min · <Users size={14} /> {recipe.servings || 2}</small></span>
                  {open === recipe.id ? <ChevronUp /> : <ChevronDown />}
                </button>
                {open === recipe.id && (
                  <div className="recipe-body">
                    <h4>Ingredientes</h4><ul>{recipe.ingredients.map((ingredient, i) => <li key={i}>{ingredient}</li>)}</ul>
                    <h4>Preparación</h4><p>{recipe.notes}</p>
                    <div className="actions"><button className="primary small" onClick={() => addRecipeToList(recipe)}>Agregar a la lista</button><button className="ghost danger small" onClick={() => deleteRecipe(recipe.id)}>Eliminar</button></div>
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
