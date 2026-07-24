import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  Warehouse
} from "lucide-react";
import { Link } from "react-router-dom";

import StatCard from "../components/StatCard";
import { Card, DemoBanner, Page } from "../components/UI";
import { useApp } from "../context/AppContext";
import { money } from "../lib/utils";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado"
];

export default function Dashboard() {
  const {
    configured,
    groceries,
    pantry,
    purchases,
    preferences,
    weeks
  } = useApp();

  const today = new Date();
  const month = today.toISOString().slice(0, 7);
  const todayName = DAYS[today.getDay()];

  const pendingGroceries = groceries.filter(
    item => !item.checked
  ).length;

  const spent = purchases
    .filter(purchase =>
      purchase.purchase_date?.startsWith(month)
    )
    .reduce(
      (total, purchase) =>
        total + Number(purchase.total || 0),
      0
    );

  const expirationLimit = new Date(
    today.getTime() + 3 * 86400000
  )
    .toISOString()
    .slice(0, 10);

  const expiring = pantry.filter(
    item =>
      item.expires_on &&
      item.expires_on <= expirationLimit
  );

  const activeWeek = weeks.find(
    week => !week.archived
  );

  const meal =
    activeWeek?.days?.[todayName]?.lunch ||
    activeWeek?.days?.[todayName]?.dinner ||
    "Sin menú";

  const budget = Number(
    preferences.monthly_budget || 0
  );

  const remainingBudget = Math.max(
    budget - spent,
    0
  );

  return (
    <Page
      title="Buenos días"
      subtitle="Este es el resumen de tu hogar."
    >
      {!configured && <DemoBanner />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
          marginBottom: 24
        }}
      >
        <StatCard
          title="Compras pendientes"
          value={pendingGroceries}
          subtitle={
            pendingGroceries === 1
              ? "producto en tu lista"
              : "productos en tu lista"
          }
          icon={<ShoppingCart size={25} />}
          color="#2563EB"
          to="/lista"
        />

        <StatCard
          title="Productos guardados"
          value={pantry.length}
          subtitle={`${expiring.length} por vencer`}
          icon={<Warehouse size={25} />}
          color="#16A34A"
          to="/despensa"
        />

        <StatCard
          title="Gasto del mes"
          value={money(spent)}
          subtitle={
            budget > 0
              ? `${money(remainingBudget)} disponibles`
              : "Sin presupuesto definido"
          }
          icon={<PiggyBank size={25} />}
          color="#D97706"
          to="/reportes"
        />

        <StatCard
          title="Menú de hoy"
          value={meal}
          subtitle={todayName}
          icon={<CalendarDays size={25} />}
          color="#7C3AED"
          to="/menu"
        />
      </div>

      {expiring.length > 0 && (
        <Card className="dashboard-alert">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: "#B45309",
                background: "#FEF3C7"
              }}
            >
              <AlertTriangle size={23} />
            </div>

            <div style={{ flex: 1 }}>
              <strong>
                Hay productos que debes aprovechar
              </strong>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#6B7280",
                  lineHeight: 1.5
                }}
              >
                {expiring
                  .slice(0, 4)
                  .map(item => item.name)
                  .join(", ")}
                {expiring.length > 4
                  ? ` y ${expiring.length - 4} más`
                  : ""}
              </p>
            </div>

            <Link
              to="/despensa"
              aria-label="Ver despensa"
              style={{
                color: "#B45309",
                display: "grid",
                placeItems: "center"
              }}
            >
              <ChevronRight size={24} />
            </Link>
          </div>
        </Card>
      )}

      <Link
        to="/asistente"
        style={{
          display: "block",
          marginTop: 24,
          textDecoration: "none",
          color: "inherit"
        }}
      >
        <div
          style={{
            borderRadius: 24,
            padding: 24,
            color: "#FFFFFF",
            background:
              "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
            boxShadow:
              "0 18px 45px rgba(37, 99, 235, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.16)",
                flexShrink: 0
              }}
            >
              <Sparkles size={28} />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  color: "#FFFFFF"
                }}
              >
                Asistente inteligente
              </h3>

              <p
                style={{
                  margin: "6px 0 0",
                  opacity: 0.86,
                  lineHeight: 1.5
                }}
              >
                Organiza compras, busca recetas y aprovecha
                mejor tu despensa.
              </p>
            </div>
          </div>

          <ChevronRight size={27} />
        </div>
      </Link>
    </Page>
  );
}
