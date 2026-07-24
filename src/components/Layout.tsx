import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChartNoAxesColumn,
  Home,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { isConfigured, supabase } from '../lib/supabase';

const mainNav = [
  ['/inicio', 'Inicio', Home],
  ['/lista', 'Compras', ListChecks],
  ['/despensa', 'Despensa', Warehouse],
  ['/menu', 'Menú', MenuIcon],
  ['/asistente', 'IA', Sparkles],
] as const;

const utilityNav = [
  ['/recetas', 'Recetas', BookOpen],
  ['/tickets', 'Tickets', ReceiptText],
  ['/reportes', 'Reportes', ChartNoAxesColumn],
  ['/ajustes', 'Ajustes', Settings],
] as const;

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <NavLink to="/inicio" className="brand">
          <span className="brand-icon"><ShoppingBasket size={24} /></span>
          <span><b>Alacena</b><small>Tu hogar, en orden</small></span>
        </NavLink>

        <nav className="sidebar-nav">
          <span className="nav-caption">PRINCIPAL</span>
          {mainNav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} /><span>{label}</span>
            </NavLink>
          ))}
          <span className="nav-caption">MÁS</span>
          {utilityNav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {isConfigured && (
          <button className="sidebar-logout" onClick={logout}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        )}
      </aside>

      <div className="app-content">
        <header className="mobile-topbar">
          <NavLink to="/inicio" className="brand compact">
            <span className="brand-icon"><ShoppingBasket size={20} /></span>
            <b>Alacena</b>
          </NavLink>
          <NavLink to="/ajustes" className="icon-btn" aria-label="Ajustes"><Settings size={21} /></NavLink>
        </header>

        <main><Outlet /></main>
      </div>

      <nav className="bottom-nav">
        {mainNav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
