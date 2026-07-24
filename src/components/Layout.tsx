import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardList,
  Home,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Sparkles,
  Warehouse,
} from "lucide-react";

import { isConfigured, supabase } from "../lib/supabase";

const mainNavigation = [
  ["/inicio", "Inicio", Home],
  ["/lista", "Lista", ClipboardList],
  ["/despensa", "Despensa", Warehouse],
  ["/menu", "Menú", MenuIcon],
  ["/asistente", "IA", Sparkles],
] as const;

const utilityNavigation = [
  ["/recetas", "Recetas", BookOpen],
  ["/tickets", "Tickets", ReceiptText],
  ["/reportes", "Reportes", ChartNoAxesColumn],
  ["/ajustes", "Ajustes", Settings],
] as const;

export default function Layout() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/inicio" className="brand">
          <span className="brand-icon">
            <ShoppingBasket size={22} />
          </span>
          <span className="brand-copy">
            <strong>Alacena</strong>
            <small>Todo tu hogar en orden</small>
          </span>
        </NavLink>

        <nav className="header-actions" aria-label="Herramientas">
          {utilityNavigation.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className="icon-btn" aria-label={label}>
              <Icon size={19} />
            </NavLink>
          ))}
          {isConfigured && (
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut size={19} />
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {mainNavigation.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
