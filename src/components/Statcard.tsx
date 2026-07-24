import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: string;
  to?: string;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = "#2563EB",
  to
}: Props) {

  const content = (
    <div
      className="card"
      style={{
        cursor: to ? "pointer" : "default",
        transition: "all .25s ease"
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: color,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#6B7280"
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          margin: "8px 0"
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            color: "#6B7280",
            fontSize: 14
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );

  if (!to) return content;

  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit"
      }}
    >
      {content}
    </Link>
  );
}
