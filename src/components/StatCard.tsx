import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "amber" | "violet";
  to: string;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "blue",
  to,
}: Props) {
  return (
    <Link to={to} className={`stat-card stat-card-${tone}`}>
      <span className="stat-card-icon">{icon}</span>
      <span className="stat-card-title">{title}</span>
      <strong>{value}</strong>
      <span className="stat-card-footer">
        {subtitle}
        <ChevronRight size={17} />
      </span>
    </Link>
  );
}
