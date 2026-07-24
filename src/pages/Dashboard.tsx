import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoBanner, Page } from '../components/UI';
import { useApp } from '../context/AppContext';
import { money } from '../lib/utils';

export default function Dashboard() {
  const { configured, groceries, pantry, purchases, preferences, weeks } = useApp();
  const month = new Date().toISOString().slice(0, 7);
  const spent = purchases
    .filter((purchase) => purchase.purchase_date.startsWith(month))
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const expiring = pantry.filter((item) => item.expires_on && item.expires_on <= new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const activeWeek = weeks.find((week) => !week.archived);
  const day = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()];
  const meal = activeWeek?.days[day]?.lunch || activeWeek?.days[day]?.dinner || 'Aún sin plan';
  const pending = groceries.filter((item) => !item.checked).length;

  return (
    <Page title="Buenos días" subtitle="Tu casa está organizada y lista para hoy.">
      {!configured && <DemoBanner />}

      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} /> RESUMEN INTELIGENTE</span>
          <h3>Todo lo importante de tu cocina, en un solo lugar.</h3>
          <p>Alacena aprende de tus compras, tu menú y lo que ya tienes para ayudarte a gastar menos y desperdiciar menos.</p>
          <Link to="/asistente" className="hero-button">Preguntar a Alacena <ChevronRight size={18} /></Link>
        </div>
        <img src="/images/kitchen-hero.svg" alt="Vista ilustrada de Alacena" />
      </section>

      <div className="metric-grid">
        <Link className="metric-card" to="/lista">
          <span className="metric-icon blue"><ShoppingCart size={22} /></span>
          <div><small>Compras pendientes</small><strong>{pending}</strong><p>{pending === 1 ? 'producto por comprar' : 'productos por comprar'}</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card" to="/despensa">
          <span className="metric-icon green"><Warehouse size={22} /></span>
          <div><small>En despensa</small><strong>{pantry.length}</strong><p>{expiring.length} por vencer pronto</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card" to="/reportes">
          <span className="metric-icon amber"><PiggyBank size={22} /></span>
          <div><small>Gasto este mes</small><strong>{money(spent)}</strong><p>Presupuesto {money(preferences.monthly_budget)}</p></div>
          <ArrowUpRight size={19} />
        </Link>
        <Link className="metric-card meal-card" to="/menu">
          <span className="metric-icon purple"><CalendarDays size={22} /></span>
          <div><small>Comida de hoy</small><strong>{meal}</strong><p>{day}</p></div>
          <ArrowUpRight size={19} />
        </Link>
      </div>

      <div className="dashboard-columns">
        <section className="panel ai-panel">
          <div className="panel-heading"><div><span className="eyebrow">SUGERENCIA DEL DÍA</span><h3>Aprovecha mejor lo que ya tienes</h3></div><Sparkles /></div>
          <p>{expiring.length ? `Hoy conviene usar ${expiring.slice(0, 3).map((item) => item.name).join(', ')} antes de que pierdan frescura.` : 'Tu despensa está en buen estado. Puedes pedirle a la IA ideas basadas en tus ingredientes.'}</p>
          <Link to="/asistente">Ver sugerencias <ChevronRight size={17} /></Link>
        </section>

        <section className="panel today-panel">
          <div className="panel-heading"><div><span className="eyebrow">HOY</span><h3>{meal}</h3></div><CalendarDays /></div>
          <p>Consulta tu menú semanal, cambia una comida o genera ingredientes faltantes automáticamente.</p>
          <Link to="/menu">Abrir menú <ChevronRight size={17} /></Link>
        </section>
      </div>

      {expiring.length > 0 && (
        <div className="expiration-alert">
          <span><AlertTriangle size={21} /></span>
          <div><strong>Productos por vencer</strong><p>{expiring.map((item) => item.name).join(', ')}</p></div>
          <Link to="/despensa"><ChevronRight /></Link>
        </div>
      )}
    </Page>
  );
}
