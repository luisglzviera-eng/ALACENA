import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  Warehouse
} from "lucide-react";

import { Link } from "react-router-dom";

import { DemoBanner, Page } from "../components/UI";
import { useApp } from "../context/AppContext";
import { money } from "../lib/utils";

export default function Dashboard() {

  const {
    configured,
    groceries,
    pantry,
    purchases,
    preferences,
    weeks
  } = useApp();

  const month = new Date().toISOString().slice(0, 7);

  const spent = purchases
    .filter(p => p.purchase_date.startsWith(month))
    .reduce((s, p) => s + Number(p.total), 0);

  const expiring = pantry.filter(item =>
    item.expires_on &&
    item.expires_on <=
      new Date(Date.now() + 3 * 86400000)
        .toISOString()
        .slice(0, 10)
  );

  const activeWeek = weeks.find(w => !w.archived);

  const today =
    [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado"
    ][new Date().getDay()];

  const meal =
    activeWeek?.days?.[today]?.lunch ||
    "Sin menú programado";

  return (

    <Page
      title="Buenos días 👋"
      subtitle="Este es el resumen de tu hogar."
    >

      {!configured && <DemoBanner />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
          gap: 22,
          marginBottom: 30
        }}
      >

        <Card
          title="Lista"
          value={groceries.filter(x => !x.checked).length.toString()}
          subtitle="productos pendientes"
          icon={<ShoppingCart size={30} />}
          color="#2563EB"
          link="/lista"
        />

        <Card
          title="Despensa"
          value={pantry.length.toString()}
          subtitle={`${expiring.length} por vencer`}
          icon={<Warehouse size={30} />}
          color="#16A34A"
          link="/despensa"
        />

        <Card
          title="Gasto"
          value={money(spent)}
          subtitle={`Presupuesto ${money(preferences.monthly_budget)}`}
          icon={<PiggyBank size={30} />}
          color="#D97706"
          link="/reportes"
        />

        <Card
          title="Hoy"
          value={meal}
          subtitle="Menú del día"
          icon={<CalendarDays size={30} />}
          color="#7C3AED"
          link="/menu"
        />

      </div>

      {expiring.length > 0 && (

        <div
          className="card"
          style={{
            marginBottom: 24,
            borderLeft: "6px solid #F59E0B",
            display: "flex",
            gap: 18,
            alignItems: "center"
          }}
        >

          <AlertTriangle
            size={28}
            color="#D97706"
          />

          <div>

            <strong>
              Productos por vencer
            </strong>

            <div
              style={{
                marginTop: 6,
                color: "#6B7280"
              }}
            >
              {expiring.map(x => x.name).join(", ")}
            </div>

          </div>

        </div>

      )}

      <Link
        to="/asistente"
        style={{
          textDecoration: "none"
        }}
      >

        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background:
              "linear-gradient(135deg,#2563EB,#4F46E5)",
            color: "white"
          }}
        >

          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center"
            }}
          >

            <Sparkles size={38} />

            <div>

              <h3
                style={{
                  marginBottom: 6
                }}
              >
                Asistente IA
              </h3>

              <div
                style={{
                  opacity: .9
                }}
              >
                Pregunta recetas, organiza compras o aprovecha
                productos antes de que caduquen.
              </div>

            </div>

          </div>

          <ArrowRight size={30} />

        </div>

      </Link>

    </Page>

  );

}

type CardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  link: string;
};

function Card({
  title,
  value,
  subtitle,
  icon,
  color,
  link
}: CardProps) {

  return (

    <Link
      to={link}
      style={{
        textDecoration: "none",
        color: "inherit"
      }}
    >

      <div
        className="card"
        style={{
          transition: ".25s",
          cursor: "pointer"
        }}
      >

        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: color,
            color: "white",
            display: "grid",
            placeItems: "center",
            marginBottom: 18
          }}
        >
          {icon}
        </div>

        <div
          style={{
            color: "#6B7280",
            fontSize: 14
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            margin: "6px 0"
          }}
        >
          {value}
        </div>

        <div
          style={{
            color: "#6B7280"
          }}
        >
          {subtitle}
        </div>

      </div>

    </Link>

  );

}
