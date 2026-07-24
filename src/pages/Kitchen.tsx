import { BookOpen, CalendarDays, ChevronRight, PackageOpen, ReceiptText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Page } from '../components/UI';
import { useApp } from '../context/AppContext';

const sections = [
  {
    to: '/despensa',
    title: 'Despensa',
    description: 'Controla existencias, mínimos y caducidades.',
    image: '/images/recipe-salad.svg',
    icon: PackageOpen,
  },
  {
    to: '/menu',
    title: 'Menú semanal',
    description: 'Planea cada comida y genera faltantes.',
    image: '/images/recipe-pasta.svg',
    icon: CalendarDays,
  },
  {
    to: '/recetas',
    title: 'Recetario',
    description: 'Guarda tus recetas y descubre nuevas ideas.',
    image: '/images/recipe-soup.svg',
    icon: BookOpen,
  },
  {
    to: '/tickets',
    title: 'Tickets',
    description: 'Escanea compras y actualiza la despensa.',
    image: '/images/kitchen-hero.svg',
    icon: ReceiptText,
  },
] as const;

export default function Kitchen() {
  const { pantry, recipes, purchases, weeks } = useApp();
  const activeWeek = weeks.find((week) => !week.archived);

  return (
    <Page title="Cocina" subtitle="Todo lo que necesitas para organizar, cocinar y aprovechar mejor.">
      <section className="kitchen-overview">
        <div>
          <span className="hero-kicker"><Sparkles size={15} /> CENTRO DE COCINA</span>
          <h3>Tu cocina, más simple y mejor conectada.</h3>
          <p>Despensa, menú, recetas y tickets trabajan juntos para ayudarte a decidir qué comprar y qué cocinar.</p>
        </div>
        <img src="/images/kitchen-hero.svg" alt="Cocina organizada con Alacena" />
      </section>

      <div className="kitchen-stats">
        <div><strong>{pantry.length}</strong><span>productos</span></div>
        <div><strong>{recipes.length}</strong><span>recetas</span></div>
        <div><strong>{purchases.length}</strong><span>compras</span></div>
        <div><strong>{activeWeek ? 'Activo' : 'Pendiente'}</strong><span>menú semanal</span></div>
      </div>

      <div className="kitchen-grid">
        {sections.map(({ to, title, description, image, icon: Icon }) => (
          <Link className="kitchen-card" to={to} key={to}>
            <img src={image} alt="" />
            <div className="kitchen-card-copy">
              <span className="kitchen-card-icon"><Icon size={20} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
              <ChevronRight size={21} />
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
