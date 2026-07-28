import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Mic,
  PiggyBank,
  Search,
  ShoppingCart,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoBanner, Page } from '../components/UI';
import { useApp } from '../context/AppContext';
import { money } from '../lib/utils';

const suggestions = [
  'Planea mi menú semanal',
  'Haz una lista para Costco',
  '¿Qué puedo cocinar hoy?',
  '¿Qué está por vencer?',
];

export default function Dashboard() {
  const { configured, groceries, pantry, purchases, preferences, weeks, recipes } = useApp();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const month = new Date().toISOString().slice(0, 7);
  const spent = purchases
    .filter((purchase) => purchase.purchase_date.startsWith(month))
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const expiring = pantry.filter((item) => item.expires_on && item.expires_on <= new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
  const lowStock = pantry.filter((item) => item.quantity <= item.low_stock_at);
  const activeWeek = weeks.find((week) => !week.archived);
  const day = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()];
  const meal = activeWeek?.days[day]?.lunch || activeWeek?.days[day]?.dinner || 'Aún sin plan';
  const pending = groceries.filter((item) => !item.checked).length;
  const budgetProgress = preferences.monthly_budget > 0 ? Math.min(100, Math.round((spent / preferences.monthly_budget) * 100)) : 0;
  const featuredRecipes = recipes.slice(0, 3);

  function askAlacena(event?: FormEvent) {
    event?.preventDefault();
    navigate('/asistente', { state: { prompt: prompt.trim() || '¿Qué puedo cocinar hoy?' } });
  }

  return (
    <Page title="Buenos días" subtitle="Esto es lo más importante de tu cocina hoy.">
      {!configured && <DemoBanner />}

      <section className="dashboard-hero compact-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} /> ALACENA INTELIGENTE</span>
          <h3>¿Qué quieres resolver hoy?</h3>
          <p>Pregunta, organiza tu menú o crea una lista usando lo que ya tienes en casa.</p>
          <form className="ai-command" onSubmit={askAlacena}>
            <Search size={20} />
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ej. Haz una lista para Costco por 15 días" />
            <button type="button" aria-label="Dictado"><Mic size={19} /></button>
            <button type="submit" aria-label="Enviar"><ArrowUpRight size={19} /></button>
          </form>
          <div className="suggestion-chips">
            {suggestions.map((item) => (
              <button key={item} onClick={() => navigate('/asistente', { state: { prompt: item } })}>{item}</button>
            ))}
          </div>
        </div>
        <div className="hero-photo-wrap">
          <img src="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=85" alt="Cocina familiar moderna" />
          <div className="hero-photo-note"><Sparkles size={16} /><span>Ideas basadas en tu despensa</span></div>
        </div>
      </section>

      <div className="metric-grid smart-metrics">
        <Link className="metric-card" to="/lista">
          <span className="metric-icon blue"><ShoppingCart size={22} /></span>
          <div><small>Compras pendientes</small><strong>{pending}</strong><p>{pending === 1 ? 'producto por comprar' : 'productos por comprar'}</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card" to="/despensa">
          <span className="metric-icon green"><Warehouse size={22} /></span>
          <div><small>Atención en despensa</small><strong>{expiring.length + lowStock.length}</strong><p>{expiring.length} por vencer · {lowStock.length} con poco stock</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card" to="/reportes">
          <span className="metric-icon amber"><PiggyBank size={22} /></span>
          <div><small>Gasto este mes</small><strong>{money(spent)}</strong><p>{budgetProgress}% de {money(preferences.monthly_budget)}</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card meal-card" to="/menu">
          <span className="metric-icon purple"><CalendarDays size={22} /></span>
          <div><small>Comida de hoy</small><strong>{meal}</strong><p>{day}</p></div>
          <ArrowUpRight size={19} />
        </Link>
      </div>

      <div className="dashboard-columns insight-layout">
        <section className="panel smart-feed">
          <div className="panel-heading"><div><span className="eyebrow">LO QUE NECESITA TU ATENCIÓN</span><h3>Tu cocina, priorizada</h3></div><Sparkles /></div>
          <div className="insight-list">
            {expiring.length > 0 && <Link to="/despensa" className="insight-item warning"><AlertTriangle /><div><strong>{expiring.length} productos vencen pronto</strong><span>{expiring.slice(0, 3).map((item) => item.name).join(', ')}</span></div><ChevronRight /></Link>}
            {lowStock.length > 0 && <Link to="/lista" className="insight-item"><ShoppingCart /><div><strong>Conviene reponer {lowStock.length} productos</strong><span>{lowStock.slice(0, 3).map((item) => item.name).join(', ')}</span></div><ChevronRight /></Link>}
            <Link to="/menu" className="insight-item"><CalendarDays /><div><strong>{meal === 'Aún sin plan' ? 'Todavía no hay comida planeada' : `Hoy toca ${meal}`}</strong><span>Revisa o ajusta tu menú semanal.</span></div><ChevronRight /></Link>
          </div>
        </section>

        <section className="panel budget-panel">
          <span className="eyebrow">PRESUPUESTO DEL MES</span>
          <div className="budget-top"><strong>{money(spent)}</strong><span>de {money(preferences.monthly_budget)}</span></div>
          <div className="budget-track"><span style={{ width: `${budgetProgress}%` }} /></div>
          <p>{budgetProgress < 70 ? 'Vas dentro del presupuesto planeado.' : budgetProgress < 100 ? 'Estás cerca del límite mensual.' : 'Superaste el presupuesto mensual.'}</p>
          <Link to="/reportes">Ver detalle <ChevronRight size={17} /></Link>
        </section>
      </div>

      <section className="recipe-strip">
        <div className="section-heading-inline"><div><span className="eyebrow">INSPIRACIÓN PARA HOY</span><h3>Ideas que se sienten hechas para tu familia</h3></div><Link to="/recetas">Ver recetas <ChevronRight size={17} /></Link></div>
        <div className="recipe-photo-grid">
          {(featuredRecipes.length ? featuredRecipes : [
            { id: '1', name: 'Pasta cremosa', tags: ['rápida'] },
            { id: '2', name: 'Ensalada fresca', tags: ['ligera'] },
            { id: '3', name: 'Tacos de pollo', tags: ['familiar'] },
          ]).map((recipe, index) => {
            const images = [
              'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82',
              'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=82',
              'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=82',
            ];
            return <Link key={recipe.id} to="/recetas" className="recipe-photo-card"><img src={images[index % images.length]} alt={recipe.name} /><div><span>{recipe.tags?.[0] || 'recomendada'}</span><strong>{recipe.name}</strong></div></Link>;
          })}
        </div>
      </section>
    </Page>
  );
}
