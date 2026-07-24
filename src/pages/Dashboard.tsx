import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  Warehouse,
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
  "Sábado",
];

export default function Dashboard() {
  const { configured, groceries, pantry, purchases, preferences, weeks } = useApp();
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const pending = groceries.filter((item) => !item.checked).length;
  const spent = purchases
    .filter((purchase) => purchase.purchase_date.startsWith(month))
    .reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const expiryLimit = new Date(now.getTime() + 3 * 86400000)
    .toISOString()
    .slice(0, 10);
  const expiring = pantry.filter(
    (item) => item.expires_on && item.expires_on <= expiryLimit
  );
  const activeWeek = weeks.find((week) => !week.archived);
  const todayName = DAYS[now.getDay()];
  const meal =
    activeWeek?.days?.[todayName]?.lunch ||
    activeWeek?.days?.[todayName]?.dinner ||
    "Sin menú";
  const budget = Number(preferences.monthly_budget || 0);
  const remaining = Math.max(budget - spent, 0);

  return (
    <Page title="Buenos días" subtitle="Este es el resumen de tu hogar.">
      {!configured && <DemoBanner />}

      <div className="dashboard-grid">
        <StatCard
          title="Compras pendientes"
          value={pending}
          subtitle="Ver lista"
          icon={<ShoppingCart size={25} />}
          tone="blue"
          to="/lista"
        />
        <StatCard
          title="Productos guardados"
          value={pantry.length}
          subtitle={`${expiring.length} por vencer`}
          icon={<Warehouse size={25} />}
          tone="green"
          to="/despensa"
        />
        <StatCard
          title="Gasto del mes"
          value={money(spent)}
          subtitle={budget > 0 ? `${money(remaining)} disponibles` : "Sin presupuesto"}
          icon={<PiggyBank size={25} />}
          tone="amber"
          to="/reportes"
        />
        <StatCard
          title="Menú de hoy"
          value={meal}
          subtitle={todayName}
          icon={<CalendarDays size={25} />}
          tone="violet"
          to="/menu"
        />
      </div>

      {expiring.length > 0 && (
        <Card className="dashboard-alert">
          <span className="alert-icon">
            <AlertTriangle size={22} />
          </span>
          <div>
            <strong>Productos que conviene aprovechar pronto</strong>
            <p>
              {expiring
                .slice(0, 4)
                .map((item) => item.name)
                .join(", ")}
              {expiring.length > 4 ? ` y ${expiring.length - 4} más` : ""}
            </p>
          </div>
          <Link to="/despensa" aria-label="Ver despensa">
            <ChevronRight size={23} />
          </Link>
        </Card>
      )}

      <Link className="assistant-hero" to="/asistente">
        <span className="assistant-hero-icon">
          <Sparkles size={28} />
        </span>
        <div>
          <strong>Asistente inteligente</strong>
          <p>Organiza compras, aprovecha sobrantes y encuentra qué cocinar.</p>
        </div>
        <ChevronRight size={26} />
      </Link>
    </Page>
  );
}
