import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChartNoAxesColumn,
  ChefHat,
  Home,
  ListChecks,
  LogOut,
  Settings,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { isConfigured, supabase } from '../lib/supabase';

const mainNav = [
  ['/inicio', 'Inicio', Home],
  ['/lista', 'Compras', ListChecks],
  ['/cocina', 'Cocina', ChefHat],
  ['/asistente', 'Alacena IA', Sparkles],
  ['/ajustes', 'Perfil', Settings],
] as const;

const desktopExtras = [
  ['/reportes', 'Reportes', ChartNoAxesColumn],
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
          <span className="nav-caption">TU HOGAR</span>
          {mainNav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} /><span>{label}</span>
            </NavLink>
          ))}
          <span className="nav-caption">ANÁLISIS</span>
          {desktopExtras.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footnote">Diseñado para tu familia</div>
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
          <NavLink to="/ajustes" className="icon-btn" aria-label="Perfil"><Settings size={21} /></NavLink>
        </header>
        <main><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {mainNav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} /><span>{label === 'Alacena IA' ? 'IA' : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
