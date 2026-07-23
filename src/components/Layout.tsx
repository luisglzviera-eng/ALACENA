import {
  NavLink,
  Outlet,
  useNavigate
} from "react-router-dom";

import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Sparkles,
  Warehouse
} from "lucide-react";

import { supabase, isConfigured } from "../lib/supabase";

const navigation = [
  {
    to: "/inicio",
    label: "Inicio",
    icon: Home
  },
  {
    to: "/lista",
    label: "Lista",
    icon: ClipboardList
  },
  {
    to: "/despensa",
    label: "Despensa",
    icon: Warehouse
  },
  {
    to: "/menu",
    label: "Menú",
    icon: Menu
  },
  {
    to: "/asistente",
    label: "IA",
    icon: Sparkles
  }
];

export default function Layout() {

  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (

    <div className="app-shell">

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255,255,255,.90)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid #E5E7EB",
          padding: "18px 26px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >

        <NavLink
          to="/inicio"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            textDecoration: "none",
            color: "#111827"
          }}
        >

          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "#2563EB",
              color: "white",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 10px 25px rgba(37,99,235,.30)"
            }}
          >
            <ShoppingBasket size={22} />
          </div>

          <div>

            <h1
              style={{
                fontFamily: "DM Serif Display",
                fontSize: 30,
                margin: 0
              }}
            >
              Alacena
            </h1>

            <div
              style={{
                color: "#6B7280",
                fontSize: 13
              }}
            >
              Organiza tu hogar
            </div>

          </div>

        </NavLink>

        <div
          style={{
            display: "flex",
            gap: 10
          }}
        >

          <NavLink to="/recetas">
            <BookOpen />
          </NavLink>

          <NavLink to="/tickets">
            <ReceiptText />
          </NavLink>

          <NavLink to="/reportes">
            <ChartNoAxesColumn />
          </NavLink>

          <NavLink to="/ajustes">
            <Settings />
          </NavLink>

          {isConfigured && (
            <button
              onClick={logout}
              style={{
                border: "none",
                background: "transparent"
              }}
            >
              <LogOut />
            </button>
          )}

        </div>

      </header>

      <main
        style={{
          maxWidth: 1400,
          margin: "40px auto",
          padding: "0 28px"
        }}
      >
        <Outlet />
      </main>

      <nav
        style={{
          position: "fixed",
          left: 20,
          right: 20,
          bottom: 20,
          background: "white",
          borderRadius: 22,
          padding: 14,
          display: "flex",
          justifyContent: "space-around",
          boxShadow: "0 18px 50px rgba(0,0,0,.12)",
          border: "1px solid #E5E7EB"
        }}
      >

        {navigation.map((item) => {

          const Icon = item.icon;

          return (

            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
                color: isActive ? "#2563EB" : "#6B7280",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500
              })}
            >

              <Icon size={22} />

              {item.label}

            </NavLink>

          );

        })}

      </nav>

    </div>

  );

}
